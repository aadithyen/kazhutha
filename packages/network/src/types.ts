import { GameEvent, Intent } from "@kazhutha/game";

export type PeerMessage =
  | { kind: "intent"; intent: Intent }
  | { kind: "events"; events: GameEvent[] }
  | { kind: "error"; reason: string }
  | { kind: "ping"; t: number }
  | { kind: "pong"; t: number };

export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export type ServerToClient =
  | { type: "joined"; peerId: string; hostId: string; role: "host" | "peer" }
  | { type: "peer-joined"; peerId: string; name: string }
  | { type: "peer-left"; peerId: string }
  | { type: "host-left" }
  | { type: "signal"; from: string; data: SignalPayload }
  | { type: "error"; message: string };

export type ClientToServer =
  | { type: "join"; roomCode: string; peerId: string; name: string }
  | { type: "signal"; to: string; data: SignalPayload }
  | { type: "leave" };

export type PeerConnectionStatus = "connecting" | "connected" | "disconnected";

export interface PeerInfo {
  id: string;
  name: string;
  status: PeerConnectionStatus;
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
