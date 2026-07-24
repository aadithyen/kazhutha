import { GameEngine, GameEvent, Intent, processIntent } from "@kazhutha/game";
import { SignalingClient } from "./signalingClient";
import { PeerLink } from "./webrtc";
import { PeerConnectionStatus, PeerInfo, PeerMessage, ServerToClient } from "./types";

export interface RoomClientOptions {
  signalingUrl: string;
  roomCode: string;
  playerId: string;
  name: string;
  iceServers?: RTCIceServer[];
}

export type RoomClientEvent =
  | { type: "peers"; peers: PeerInfo[] }
  | { type: "error"; message: string }
  | { type: "hostLeft" }
  | { type: "signalingStatus"; connected: boolean };

type Handler = (ev: RoomClientEvent) => void;

/**
 * Star-topology P2P room: every peer opens one WebRTC DataChannel directly to
 * the host. The host runs the authoritative game engine and broadcasts
 * resulting events; every client (including the host) applies the same
 * events through the identical reducer, so state stays in sync. The
 * signalling server only ever sees SDP/ICE payloads and room membership.
 */
export class RoomClient {
  readonly engine: GameEngine;
  readonly playerId: string;
  readonly name: string;
  readonly roomCode: string;
  isHost = false;
  hostId: string | null = null;

  private signaling: SignalingClient;
  private links = new Map<string, PeerLink>();
  private peerNames = new Map<string, string>();
  private peerStatus = new Map<string, PeerConnectionStatus>();
  private handlers = new Set<Handler>();
  private iceServers?: RTCIceServer[];

  constructor(opts: RoomClientOptions) {
    this.playerId = opts.playerId;
    this.name = opts.name;
    this.roomCode = opts.roomCode;
    this.iceServers = opts.iceServers;
    this.engine = new GameEngine(opts.roomCode);
    this.signaling = new SignalingClient(opts.signalingUrl);
    this.signaling.onMessage((msg) => this.handleSignalingMessage(msg));
    this.signaling.onStatus((connected) => this.emit({ type: "signalingStatus", connected }));
  }

  connect() {
    this.signaling.connect({
      type: "join",
      roomCode: this.roomCode,
      peerId: this.playerId,
      name: this.name,
    });
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  sendIntent(intent: Intent) {
    if (this.isHost) {
      this.handleIntentAsHost(intent, null);
      return;
    }
    const hostLink = this.hostId ? this.links.get(this.hostId) : null;
    hostLink?.send({ kind: "intent", intent });
  }

  requestSnapshot() {
    this.sendIntent({ type: "RequestSnapshot", playerId: this.playerId });
  }

  disconnect() {
    this.signaling.close();
    for (const link of this.links.values()) link.close();
    this.links.clear();
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peerNames.entries()).map(([id, name]) => ({
      id,
      name,
      status: this.peerStatus.get(id) ?? "connecting",
    }));
  }

  private emit(ev: RoomClientEvent) {
    this.handlers.forEach((h) => h(ev));
  }

  private handleSignalingMessage(msg: ServerToClient) {
    switch (msg.type) {
      case "joined": {
        this.hostId = msg.hostId;
        if (msg.role === "host") {
          this.becomeHost();
        } else {
          this.connectToHost(msg.hostId);
        }
        break;
      }
      case "peer-joined": {
        this.peerNames.set(msg.peerId, msg.name);
        if (this.isHost) this.ensureLinkAsAnswerer(msg.peerId);
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "peer-left": {
        if (this.isHost) this.handlePeerDisconnected(msg.peerId);
        this.links.get(msg.peerId)?.close();
        this.links.delete(msg.peerId);
        this.peerNames.delete(msg.peerId);
        this.peerStatus.delete(msg.peerId);
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "host-left":
        this.emit({ type: "hostLeft" });
        break;
      case "signal": {
        const link = this.links.get(msg.from) ?? (this.isHost ? this.ensureLinkAsAnswerer(msg.from) : null);
        link?.handleSignal(msg.data);
        break;
      }
      case "error":
        this.emit({ type: "error", message: msg.message });
        break;
    }
  }

  private becomeHost() {
    this.isHost = true;
    this.engine.apply({ type: "RoomCreated", roomCode: this.roomCode, hostId: this.playerId });
    this.handleIntentAsHost({ type: "JoinRoom", playerId: this.playerId, name: this.name }, null);
  }

  private connectToHost(hostId: string) {
    const link = new PeerLink({
      peerId: hostId,
      iceServers: this.iceServers,
      onSignal: (data) => this.signaling.send({ type: "signal", to: hostId, data }),
      onMessage: (msg) => this.handlePeerMessage(hostId, msg),
      onStatus: (status) => this.handleLinkStatus(hostId, status),
    });
    this.links.set(hostId, link);
    link.createOffer();
  }

  private ensureLinkAsAnswerer(peerId: string): PeerLink {
    const existing = this.links.get(peerId);
    if (existing) return existing;
    const link = new PeerLink({
      peerId,
      iceServers: this.iceServers,
      onSignal: (data) => this.signaling.send({ type: "signal", to: peerId, data }),
      onMessage: (msg) => this.handlePeerMessage(peerId, msg),
      onStatus: (status) => this.handleLinkStatus(peerId, status),
    });
    this.links.set(peerId, link);
    return link;
  }

  private handleLinkStatus(peerId: string, status: PeerConnectionStatus) {
    this.peerStatus.set(peerId, status);
    this.emit({ type: "peers", peers: this.getPeers() });
    if (!this.isHost && status === "connected" && peerId === this.hostId) {
      this.sendIntent({ type: "JoinRoom", playerId: this.playerId, name: this.name });
    }
    if (this.isHost && status === "disconnected") {
      this.handlePeerDisconnected(peerId);
    }
  }

  private handlePeerMessage(fromPeerId: string, msg: PeerMessage) {
    if (msg.kind === "intent" && this.isHost) {
      this.handleIntentAsHost(msg.intent, fromPeerId);
    } else if (msg.kind === "events") {
      this.engine.applyMany(msg.events);
    } else if (msg.kind === "error") {
      this.emit({ type: "error", message: msg.reason });
    }
  }

  private handleIntentAsHost(intent: Intent, sourcePeerId: string | null) {
    const result = processIntent(this.engine.getState(), intent);
    if (!result.ok) {
      if (sourcePeerId) this.links.get(sourcePeerId)?.send({ kind: "error", reason: result.reason });
      else this.emit({ type: "error", message: result.reason });
      return;
    }
    if (result.events.length > 0) {
      this.engine.applyMany(result.events);
      this.broadcastEvents(result.events);
    }
    if (intent.type === "JoinRoom" && sourcePeerId) {
      const snapshot: GameEvent = { type: "StateSnapshot", state: this.engine.getState() };
      this.links.get(sourcePeerId)?.send({ kind: "events", events: [snapshot] });
    }
    if (intent.type === "RequestSnapshot" && sourcePeerId) {
      const snapshot: GameEvent = { type: "StateSnapshot", state: this.engine.getState() };
      this.links.get(sourcePeerId)?.send({ kind: "events", events: [snapshot] });
    }
  }

  private handlePeerDisconnected(peerId: string) {
    if (!this.isHost) return;
    const state = this.engine.getState();
    if (!state.players.some((p) => p.id === peerId && p.connected)) return;
    const events: GameEvent[] = [{ type: "PlayerLeft", playerId: peerId }];
    this.engine.applyMany(events);
    this.broadcastEvents(events);
  }

  private broadcastEvents(events: GameEvent[]) {
    for (const link of this.links.values()) {
      link.send({ kind: "events", events });
    }
  }
}
