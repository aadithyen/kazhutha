import { createServer, IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientMessage, ServerToClient } from "./protocol.js";
import { RoomRegistry } from "./rooms.js";
import { generateIceServers } from "./turn.js";

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

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: registry.roomCount() }));
    return;
  }
  if (req.url === "/ice-servers") {
    const allowOrigin = corsOrigin(req);
    if (!allowOrigin) {
      res.writeHead(403);
      res.end();
      return;
    }
    void generateIceServers().then((iceServers) => {
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": allowOrigin,
        vary: "origin",
      });
      res.end(JSON.stringify({ iceServers }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: ({ origin }: { origin: string }) => originAllowed(origin),
});

function send(ws: WebSocket, msg: ServerToClient) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

interface SocketMeta {
  alive: boolean;
  tokens: number;
  lastRefill: number;
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

wss.on("connection", (ws) => {
  let roomCode: string | null = null;
  let peerId: string | null = null;
  let joined = false;
  meta.set(ws, { alive: true, tokens: RATE_LIMIT_BURST, lastRefill: Date.now() });

  // Without a listener, an 'error' on a client socket (bad frame, reset) is
  // an unhandled EventEmitter error and takes the whole process down.
  ws.on("error", () => {
    ws.terminate();
  });

  ws.on("pong", () => {
    const m = meta.get(ws);
    if (m) m.alive = true;
  });

  ws.on("message", (raw) => {
    if (!takeToken(ws)) {
      ws.close(1008, "rate limit");
      return;
    }
    const msg = parseClientMessage(raw.toString());
    if (!msg) return;

    if (msg.type === "join") {
      if (joined) return;
      const room = registry.getOrCreate(msg.roomCode);

      const previous = room.peers.get(msg.peerId);
      previous?.ws.close();

      if (previous) {
        room.peers.set(msg.peerId, { ...previous, name: msg.name, ws });
      } else {
        room.peers.set(msg.peerId, { peerId: msg.peerId, name: msg.name, ws, joinedAt: Date.now() });
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

      for (const peer of room.peers.values()) {
        if (peer.peerId === msg.peerId) continue;
        send(peer.ws, { type: "peer-joined", peerId: msg.peerId, name: msg.name });
      }
      return;
    }

    if (!joined || !roomCode || !peerId) return;
    const room = registry.get(roomCode);
    if (!room) return;

    if (msg.type === "signal") {
      const target = room.peers.get(msg.to);
      if (target) send(target.ws, { type: "signal", from: peerId, data: msg.data });
      return;
    }

    if (msg.type === "leave") {
      ws.close();
    }
  });

  ws.on("close", () => {
    if (!roomCode || !peerId) return;
    const room = registry.get(roomCode);
    if (!room) return;
    const current = room.peers.get(peerId);
    // Ignore close from a superseded socket (same peerId rejoined on a new ws).
    if (!current || current.ws !== ws) return;
    registry.removePeer(roomCode, peerId);
    if (room.peers.size === 0) return;

    for (const peer of room.peers.values()) {
      send(peer.ws, { type: "peer-left", peerId });
    }
  });
});

// Half-open TCP connections never emit 'close'; a zombie peer would otherwise
// stay in its room forever and, as earliest joiner, block lobby host election.
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
  console.log(`kazhutha signalling server listening on :${PORT}`);
});
