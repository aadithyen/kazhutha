import type { WebSocket } from "ws";

export interface RoomPeer {
  peerId: string;
  name: string;
  ws: WebSocket;
  /** Preserved across reconnects so lobby host election stays stable. */
  joinedAt: number;
}

export interface Room {
  code: string;
  peers: Map<string, RoomPeer>;
}

/** In-memory only, by design: the tracker holds no gameplay state and nothing to persist. */
export class RoomRegistry {
  private rooms = new Map<string, Room>();

  getOrCreate(code: string): Room {
    let room = this.rooms.get(code);
    if (!room) {
      room = { code, peers: new Map() };
      this.rooms.set(code, room);
    }
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  removePeer(code: string, peerId: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.peers.delete(peerId);
    if (room.peers.size === 0) this.rooms.delete(code);
  }

  roomCount(): number {
    return this.rooms.size;
  }

  playerCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.peers.size;
    }
    return total;
  }

  listRooms(): { code: string; playerCount: number; peers: { peerId: string; name: string }[] }[] {
    const out: { code: string; playerCount: number; peers: { peerId: string; name: string }[] }[] = [];
    for (const room of this.rooms.values()) {
      out.push({
        code: room.code,
        playerCount: room.peers.size,
        peers: Array.from(room.peers.values()).map((p) => ({ peerId: p.peerId, name: p.name })),
      });
    }
    out.sort((a, b) => b.playerCount - a.playerCount || a.code.localeCompare(b.code));
    return out;
  }
}
