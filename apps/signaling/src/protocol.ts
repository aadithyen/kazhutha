export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "candidate"; candidate: unknown };

export type ClientToServer =
  | { type: "join"; roomCode: string; peerId: string; name: string }
  | { type: "signal"; to: string; data: SignalPayload }
  | { type: "sync-host"; newHostId: string }
  | { type: "leave" };

export type RoomPeerInfo = { peerId: string; name: string };

export type ServerToClient =
  | { type: "joined"; peerId: string; hostId: string; role: "host" | "peer"; peers: RoomPeerInfo[] }
  | { type: "peer-joined"; peerId: string; name: string }
  | { type: "peer-left"; peerId: string }
  | { type: "host-left" }
  | { type: "host-changed"; hostId: string }
  | { type: "signal"; from: string; data: SignalPayload }
  | { type: "error"; message: string };

const MAX_ROOM_CODE_LEN = 32;
const MAX_ID_LEN = 64;
const MAX_NAME_LEN = 24;

export function parseClientMessage(raw: string): ClientToServer | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;

  if (msg.type === "join") {
    if (
      typeof msg.roomCode === "string" &&
      msg.roomCode.length > 0 &&
      msg.roomCode.length <= MAX_ROOM_CODE_LEN &&
      typeof msg.peerId === "string" &&
      msg.peerId.length > 0 &&
      msg.peerId.length <= MAX_ID_LEN &&
      typeof msg.name === "string"
    ) {
      return { type: "join", roomCode: msg.roomCode, peerId: msg.peerId, name: msg.name.slice(0, MAX_NAME_LEN) };
    }
    return null;
  }

  if (msg.type === "signal") {
    if (typeof msg.to === "string" && msg.to.length > 0 && msg.to.length <= MAX_ID_LEN && isSignalPayload(msg.data)) {
      return { type: "signal", to: msg.to, data: msg.data };
    }
    return null;
  }

  if (msg.type === "leave") return { type: "leave" };

  if (msg.type === "sync-host") {
    if (typeof msg.newHostId === "string" && msg.newHostId.length > 0 && msg.newHostId.length <= MAX_ID_LEN) {
      return { type: "sync-host", newHostId: msg.newHostId };
    }
    return null;
  }

  return null;
}

function isSignalPayload(data: unknown): data is SignalPayload {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.kind === "offer" || d.kind === "answer") return typeof d.sdp === "string";
  if (d.kind === "candidate") return "candidate" in d;
  return false;
}
