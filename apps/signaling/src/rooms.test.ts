import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RoomRegistry } from "./rooms.js";

describe("RoomRegistry", () => {
  it("tracks room and player counts", () => {
    const registry = new RoomRegistry();
    assert.equal(registry.roomCount(), 0);
    assert.equal(registry.playerCount(), 0);

    const room = registry.getOrCreate("ABC");
    room.peers.set("p1", { peerId: "p1", name: "A", ws: null as never, joinedAt: 0 });
    assert.equal(registry.roomCount(), 1);
    assert.equal(registry.playerCount(), 1);

    room.peers.set("p2", { peerId: "p2", name: "B", ws: null as never, joinedAt: 1 });
    assert.equal(registry.playerCount(), 2);

    registry.removePeer("ABC", "p1");
    assert.equal(registry.roomCount(), 1);
    assert.equal(registry.playerCount(), 1);

    registry.removePeer("ABC", "p2");
    assert.equal(registry.roomCount(), 0);
    assert.equal(registry.playerCount(), 0);
  });
});
