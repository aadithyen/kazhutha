import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientMessage, ServerToClient } from "./protocol.js";
import { buildRoster, RoomRegistry } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 8080);
const registry = new RoomRegistry();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: registry.roomCount() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

function send(ws: WebSocket, msg: ServerToClient) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastRoster(roomCode: string) {
  const room = registry.get(roomCode);
  if (!room || room.peers.size === 0) return;
  const { hostId, roster } = buildRoster(room);
  const msg: ServerToClient = { type: "roster", hostId, roster };
  for (const peer of room.peers.values()) {
    send(peer.ws, msg);
  }
}

wss.on("connection", (ws) => {
  let roomCode: string | null = null;
  let peerId: string | null = null;
  let joined = false;

  ws.on("message", (raw) => {
    const msg = parseClientMessage(raw.toString());
    if (!msg) return;

    if (msg.type === "join") {
      if (joined) return;
      const room = registry.getOrCreate(msg.roomCode, msg.peerId);
      const role = room.hostId === msg.peerId ? "host" : "peer";

      const previous = room.peers.get(msg.peerId);
      previous?.ws.close();

      room.peers.set(msg.peerId, { peerId: msg.peerId, name: msg.name, ws });
      roomCode = msg.roomCode;
      peerId = msg.peerId;
      joined = true;

      const { hostId, roster } = buildRoster(room);
      send(ws, { type: "joined", peerId: msg.peerId, hostId, role, roster });
      broadcastRoster(roomCode);
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

    if (msg.type === "sync-host") {
      if (!registry.transferHost(roomCode, msg.newHostId)) return;
      broadcastRoster(roomCode);
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
    const wasHost = room.hostId === peerId;
    registry.removePeer(roomCode, peerId);
    if (room.peers.size === 0) return;

    if (wasHost) {
      const newHostId = room.peers.keys().next().value!;
      registry.transferHost(roomCode, newHostId);
    }
    broadcastRoster(roomCode);
  });
});

httpServer.listen(PORT, () => {
  console.log(`kazhutha signalling server listening on :${PORT}`);
});
