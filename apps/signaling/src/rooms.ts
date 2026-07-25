import type { WebSocket } from "ws";

export interface RoomPeer {
  peerId: string;
  name: string;
  ws: WebSocket;
}

export interface Room {
  code: string;
  hostId: string;
  peers: Map<string, RoomPeer>;
}

/** In-memory only, by design: the tracker holds no gameplay state and nothing to persist. */
export class RoomRegistry {
  private rooms = new Map<string, Room>();

  getOrCreate(code: string, firstPeerId: string): Room {
    let room = this.rooms.get(code);
    if (!room) {
      room = { code, hostId: firstPeerId, peers: new Map() };
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
}
