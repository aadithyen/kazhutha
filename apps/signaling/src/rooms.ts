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

export type RoomRoster = { hostId: string; roster: { peerId: string; name: string }[] };

export function buildRoster(room: Room): RoomRoster {
  return {
    hostId: room.hostId,
    roster: Array.from(room.peers.values()).map((p) => ({ peerId: p.peerId, name: p.name })),
  };
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

  transferHost(code: string, newHostId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.peers.has(newHostId)) return false;
    room.hostId = newHostId;
    return true;
  }

  roomCount(): number {
    return this.rooms.size;
  }
}
