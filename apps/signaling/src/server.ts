import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { loadAppConfig } from "./appConfig.js";
import { createTraceId } from "./telemetry/correlation.js";
import { parseClientMessage, ServerToClient } from "./protocol.js";
import { RoomRegistry } from "./rooms.js";
import { generateIceServers } from "./turn.js";
import { clientIp, handleTelemetryIngest, obs, trackHttpRequest } from "./observability.js";
import { isClientVersionSupported } from "./version.js";

const appConfig = loadAppConfig();

const PORT = Number(process.env.PORT ?? 8080);
/**
 * Comma-separated list of allowed browser origins. Unset = allow any origin
 * (local development). When set, WebSocket upgrades and /ice-servers requests
 * from other origins are refused.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const HEARTBEAT_MS = 30_000;
/** Per-socket token bucket: signalling bursts during ICE are ~20-40 messages. */
const RATE_LIMIT_BURST = 60;
const RATE_LIMIT_PER_SEC = 20;
const MAX_MESSAGE_BYTES = 64 * 1024;

const registry = new RoomRegistry();

function originAllowed(origin: string | undefined): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

function corsOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length === 0) return "*";
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function finishResponse(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  start: number,
  traceId: string,
  work: () => void | Promise<void>,
): void {
  const onFinish = () => trackHttpRequest(req, res, route, start, traceId);
  res.on("finish", onFinish);
  void Promise.resolve(work()).catch((err) => {
    obs.logger.error("HTTP handler failed", { traceId, route, error: err });
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    }
  });
}

const httpServer = createServer((req, res) => {
  const start = Date.now();
  const traceId = createTraceId();
  const route = req.url?.split("?")[0] ?? "/";

  if (route === "/health") {
    finishResponse(req, res, "/health", start, traceId, () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: registry.roomCount() }));
    });
    return;
  }

  if (route === "/version") {
    const allowOrigin = corsOrigin(req);
    finishResponse(req, res, "/version", start, traceId, () => {
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-cache, no-store, must-revalidate",
        ...(allowOrigin ? { "access-control-allow-origin": allowOrigin, vary: "origin" } : {}),
      });
      res.end(
        JSON.stringify({
          version: appConfig.version,
          minClientVersion: appConfig.minClientVersion || undefined,
        }),
      );
    });
    return;
  }

  if (route === "/ice-servers") {
    const allowOrigin = corsOrigin(req);
    if (!allowOrigin) {
      obs.security.record("unauthorized_access", "ICE servers origin rejected", {
        source: clientIp(req),
        route: "/ice-servers",
        traceId,
      });
      res.writeHead(403);
      res.on("finish", () => trackHttpRequest(req, res, "/ice-servers", start, traceId));
      res.end();
      return;
    }
    finishResponse(req, res, "/ice-servers", start, traceId, async () => {
      const iceServers = await generateIceServers();
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": allowOrigin,
        vary: "origin",
      });
      res.end(JSON.stringify({ iceServers }));
    });
    return;
  }

  if (route === "/telemetry" && req.method === "POST") {
    finishResponse(req, res, "/telemetry", start, traceId, async () => {
      await handleTelemetryIngest(req, res, corsOrigin(req));
    });
    return;
  }

  obs.security.record("invalid_request", "Unknown HTTP route", {
    source: clientIp(req),
    route,
    traceId,
    detail: req.method,
  });
  res.writeHead(404);
  res.on("finish", () => trackHttpRequest(req, res, route, start, traceId));
  res.end();
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }) => {
    if (!originAllowed(origin)) {
      obs.security.record("unauthorized_access", "WebSocket origin rejected", {
        source: clientIp(req),
        route: "/ws",
      });
      return false;
    }
    return true;
  },
});

obs.metrics?.registerOperationalGauges(() => ({
  activeRooms: registry.roomCount(),
  activePlayers: registry.playerCount(),
  websocketConnections: wss.clients.size,
}));

function send(ws: WebSocket, msg: ServerToClient) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

interface SocketMeta {
  alive: boolean;
  tokens: number;
  lastRefill: number;
  traceId: string;
  connectedAt: number;
  source: string;
  invalidMessages: number;
  signalMessages: number;
  reconnect: boolean;
}

const meta = new WeakMap<WebSocket, SocketMeta>();

function takeToken(ws: WebSocket): boolean {
  const m = meta.get(ws);
  if (!m) return true;
  const now = Date.now();
  m.tokens = Math.min(RATE_LIMIT_BURST, m.tokens + ((now - m.lastRefill) / 1000) * RATE_LIMIT_PER_SEC);
  m.lastRefill = now;
  if (m.tokens < 1) return false;
  m.tokens -= 1;
  return true;
}

wss.on("connection", (ws, req) => {
  let roomCode: string | null = null;
  let peerId: string | null = null;
  let joined = false;
  const traceId = createTraceId();
  const source = clientIp(req);
  const connectedAt = Date.now();

  meta.set(ws, {
    alive: true,
    tokens: RATE_LIMIT_BURST,
    lastRefill: Date.now(),
    traceId,
    connectedAt,
    source,
    invalidMessages: 0,
    signalMessages: 0,
    reconnect: false,
  });

  obs.metrics?.activeConnections.add(1);
  obs.metrics?.signalingConnectionsTotal.add(1);

  obs.logger.info("Signaling connection opened", { traceId, route: "/ws" });
  obs.security.trackRequest(source, "/ws", traceId);

  ws.on("error", () => {
    obs.metrics?.signalingErrorsTotal.add(1, { reason: "socket_error" });
    obs.logger.warn("Signaling socket error", { traceId, roomCode: roomCode ?? undefined, peerId: peerId ?? undefined });
    ws.terminate();
  });

  ws.on("pong", () => {
    const m = meta.get(ws);
    if (m) m.alive = true;
  });

  ws.on("message", (raw) => {
    const m = meta.get(ws);
    if (!takeToken(ws)) {
      obs.metrics?.signalingErrorsTotal.add(1, { reason: "rate_limit" });
      obs.security.record("rate_limit_exceeded", "Signaling rate limit exceeded", {
        source,
        route: "/ws",
        traceId: m?.traceId,
        sessionId: roomCode ?? undefined,
        peerId: peerId ?? undefined,
      });
      obs.logger.warn("Signaling rate limit exceeded", {
        traceId: m?.traceId,
        roomCode: roomCode ?? undefined,
        peerId: peerId ?? undefined,
        securityEventType: "rate_limit_exceeded",
      });
      ws.close(1008, "rate limit");
      return;
    }

    const msg = parseClientMessage(raw.toString());
    if (!msg) {
      if (m) m.invalidMessages += 1;
      obs.metrics?.signalingMessageErrorsTotal.add(1, { reason: "invalid_json" });
      if (m && m.invalidMessages >= 5) {
        obs.security.record("signaling_abuse", "Repeated invalid signaling messages", {
          source,
          route: "/ws",
          traceId: m.traceId,
          sessionId: roomCode ?? undefined,
          peerId: peerId ?? undefined,
          detail: `${m.invalidMessages} invalid messages`,
        });
      }
      return;
    }

    if (msg.type === "join") {
      if (joined) return;

      if (appConfig.minClientVersion) {
        const clientVersion = msg.clientVersion?.trim();
        if (!clientVersion || !isClientVersionSupported(clientVersion, appConfig.minClientVersion)) {
          obs.metrics?.signalingMessageErrorsTotal.add(1, { reason: "client_version" });
          obs.security.record("invalid_request", "Client version rejected", {
            source,
            route: "/ws",
            traceId: m?.traceId,
            sessionId: msg.roomCode,
            peerId: msg.peerId,
            detail: clientVersion ?? "missing",
          });
          send(ws, { type: "error", message: "Client version too old" });
          ws.close(1008, "client version");
          return;
        }
      }

      const room = registry.getOrCreate(msg.roomCode);
      const roomWasEmpty = room.peers.size === 0;

      const previous = room.peers.get(msg.peerId);
      if (previous) {
        if (m) m.reconnect = true;
        obs.metrics?.signalingReconnectsTotal.add(1);
        obs.logger.info("Signaling peer reconnected", {
          traceId: m?.traceId,
          roomCode: msg.roomCode,
          peerId: msg.peerId,
        });
      }
      previous?.ws.close();

      if (previous) {
        room.peers.set(msg.peerId, { ...previous, name: msg.name, ws });
      } else {
        room.peers.set(msg.peerId, { peerId: msg.peerId, name: msg.name, ws, joinedAt: Date.now() });
        obs.metrics?.signalingPlayersJoinedTotal.add(1);
        if (roomWasEmpty) obs.metrics?.signalingRoomsCreatedTotal.add(1);
      }
      roomCode = msg.roomCode;
      peerId = msg.peerId;
      joined = true;

      const joinOrder = Array.from(room.peers.values())
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => p.peerId);

      const peers = joinOrder
        .filter((id) => id !== msg.peerId)
        .map((id) => {
          const peer = room.peers.get(id)!;
          return { peerId: peer.peerId, name: peer.name };
        });

      send(ws, { type: "joined", peerId: msg.peerId, peers, joinOrder });

      obs.logger.info("Player joined room", {
        traceId: m?.traceId,
        roomCode: msg.roomCode,
        peerId: msg.peerId,
        sessionId: msg.roomCode,
        player_count: room.peers.size,
        reconnect: m?.reconnect,
      });

      for (const peer of room.peers.values()) {
        if (peer.peerId === msg.peerId) continue;
        send(peer.ws, { type: "peer-joined", peerId: msg.peerId, name: msg.name });
      }
      return;
    }

    if (!joined || !roomCode || !peerId) {
      obs.metrics?.signalingMessageErrorsTotal.add(1, { reason: "unjoined" });
      obs.security.record("invalid_request", "Message before join", {
        source,
        route: "/ws",
        traceId: m?.traceId,
        detail: msg.type,
      });
      return;
    }
    const room = registry.get(roomCode);
    if (!room) return;

    if (msg.type === "signal") {
      if (m) m.signalMessages += 1;
      const target = room.peers.get(msg.to);
      if (!target) {
        obs.metrics?.signalingMessageErrorsTotal.add(1, { reason: "unknown_peer" });
        return;
      }
      if (!isSignalPayloadKind(msg.data)) {
        obs.metrics?.signalingMessageErrorsTotal.add(1, { reason: "invalid_signal" });
        obs.security.record("signaling_abuse", "Invalid signal payload", {
          source,
          route: "/ws",
          traceId: m?.traceId,
          sessionId: roomCode,
          peerId,
          detail: String((msg.data as { kind?: string }).kind),
        });
        return;
      }
      send(target.ws, { type: "signal", from: peerId, data: msg.data });
      return;
    }

    if (msg.type === "leave") {
      ws.close();
    }
  });

  ws.on("close", () => {
    obs.metrics?.activeConnections.add(-1);
    const m = meta.get(ws);
    const durationMs = m ? Date.now() - m.connectedAt : undefined;
    if (durationMs !== undefined) {
      obs.metrics?.signalingConnectionDurationMs.record(durationMs, {
        reconnect: m?.reconnect ? "true" : "false",
      });
    }
    obs.logger.info("Signaling connection closed", {
      traceId: m?.traceId,
      roomCode: roomCode ?? undefined,
      peerId: peerId ?? undefined,
      durationMs,
      reconnect: m?.reconnect,
      signal_messages: m?.signalMessages,
    });

    if (!roomCode || !peerId) return;
    const room = registry.get(roomCode);
    if (!room) return;
    const current = room.peers.get(peerId);
    if (!current || current.ws !== ws) return;
    registry.removePeer(roomCode, peerId);
    obs.metrics?.signalingPlayersLeftTotal.add(1);
    if (room.peers.size === 0) return;

    obs.logger.info("Player left room", {
      traceId: m?.traceId,
      roomCode,
      peerId,
      sessionId: roomCode,
      player_count: room.peers.size,
    });

    for (const peer of room.peers.values()) {
      send(peer.ws, { type: "peer-left", peerId });
    }
  });
});

function isSignalPayloadKind(data: { kind: string }): boolean {
  return data.kind === "offer" || data.kind === "answer" || data.kind === "candidate";
}

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const m = meta.get(ws);
    if (!m) continue;
    if (!m.alive) {
      ws.terminate();
      continue;
    }
    m.alive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  obs.logger.info(`kazhutha signalling server listening on :${PORT}`, { route: "/startup" });
});

process.on("SIGTERM", () => {
  void obs.shutdown().finally(() => process.exit(0));
});
