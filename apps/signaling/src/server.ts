import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientMessage, ServerToClient } from "./protocol.js";
import { RoomRegistry } from "./rooms.js";
import { generateIceServers } from "./turn.js";

const PORT = Number(process.env.PORT ?? 8080);
const registry = new RoomRegistry();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: registry.roomCount() }));
    return;
  }
  if (req.url === "/ice-servers") {
    void generateIceServers().then((iceServers) => {
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(JSON.stringify({ iceServers }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

function send(ws: WebSocket, msg: ServerToClient) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
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

httpServer.listen(PORT, () => {
  console.log(`kazhutha signalling server listening on :${PORT}`);
});
