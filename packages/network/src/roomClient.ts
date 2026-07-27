import {
  GameEngine,
  GameEvent,
  GameState,
  Intent,
  eventsForHostDisconnect,
  getAuthorityId,
  processIntent,
} from "@kazhutha/game";
import { SignalingClient } from "./signalingClient";
import { PeerLink } from "./webrtc";
import { PeerConnectionStatus, PeerInfo, PeerMessage, ServerToClient } from "./types";

export interface RoomClientOptions {
  signalingUrl: string;
  roomCode: string;
  playerId: string;
  name: string;
  iceServers?: RTCIceServer[];
  /** Restore persisted state before networking (host reload recovery). */
  persistedState?: GameState | null;
}

export type RoomClientEvent =
  | { type: "peers"; peers: PeerInfo[] }
  | { type: "error"; message: string }
  | { type: "hostLeft" }
  | { type: "hostReconnected" }
  | { type: "signalingStatus"; connected: boolean };

type Handler = (ev: RoomClientEvent) => void;

const STATE_PREFIX = "kazhutha:state:";
const KEEPALIVE_MS = 15_000;

/**
 * Star-topology P2P room: every peer opens one WebRTC DataChannel to the
 * room host. The host runs the game engine and broadcasts events; every client
 * applies the same events through the identical reducer.
 *
 * If the host disconnects mid-game, all peers pause locally until the host
 * rejoins and resumes.
 */
export class RoomClient {
  readonly engine: GameEngine;
  readonly playerId: string;
  readonly name: string;
  readonly roomCode: string;
  hostId: string | null = null;
  isAuthority = false;

  private signaling: SignalingClient;
  private links = new Map<string, PeerLink>();
  private knownPeers = new Map<string, string>();
  private peerStatus = new Map<string, PeerConnectionStatus>();
  private handlers = new Set<Handler>();
  private iceServers?: RTCIceServer[];
  private recoveringHost: boolean;
  private snapshotRequested = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(opts: RoomClientOptions) {
    this.playerId = opts.playerId;
    this.name = opts.name;
    this.roomCode = opts.roomCode;
    this.iceServers = opts.iceServers;
    this.engine = new GameEngine(opts.roomCode);
    if (opts.persistedState?.roomCode === opts.roomCode && opts.persistedState.hostId) {
      this.engine.apply({ type: "StateSnapshot", state: opts.persistedState });
      this.hostId = opts.persistedState.hostId;
    }
    this.signaling = new SignalingClient(opts.signalingUrl);
    this.signaling.onMessage((msg) => this.handleSignalingMessage(msg));
    this.signaling.onStatus((connected) => {
      this.emit({ type: "signalingStatus", connected });
      if (!connected) this.handleSignalingDisconnect();
      else if (this.engine.getState().paused && this.engine.getState().hostId === this.playerId) {
        this.resumeAsHost();
      }
    });
    this.recoveringHost =
      !!opts.persistedState &&
      opts.persistedState.hostId === opts.playerId &&
      opts.persistedState.phase !== "lobby";
    this.syncAuthorityFromState();
    this.startKeepalive();
    this.bindVisibilityReconnect();
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
    if (this.isAuthority) {
      this.handleIntentAsAuthority(intent, null);
      return;
    }
    const authorityId = this.authorityTarget();
    const link = authorityId ? this.links.get(authorityId) : null;
    link?.send({ kind: "intent", intent });
  }

  requestSnapshot() {
    this.sendIntent({ type: "RequestSnapshot", playerId: this.playerId });
  }

  disconnect() {
    this.stopKeepalive();
    this.unbindVisibilityReconnect();
    this.signaling.close();
    for (const link of this.links.values()) link.close();
    this.links.clear();
  }

  leave() {
    this.signaling.send({ type: "leave" });
    try {
      sessionStorage.removeItem(STATE_PREFIX + this.roomCode);
    } catch {
      // private mode or quota
    }
    this.disconnect();
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.knownPeers.entries()).map(([id, name]) => ({
      id,
      name,
      status: this.peerStatus.get(id) ?? "connecting",
    }));
  }

  static loadPersistedState(roomCode: string): GameState | null {
    try {
      const raw = sessionStorage.getItem(STATE_PREFIX + roomCode);
      if (!raw) return null;
      return JSON.parse(raw) as GameState;
    } catch {
      return null;
    }
  }

  private emit(ev: RoomClientEvent) {
    this.handlers.forEach((h) => h(ev));
  }

  private persistState() {
    if (!this.isAuthority) return;
    try {
      sessionStorage.setItem(STATE_PREFIX + this.roomCode, JSON.stringify(this.engine.getState()));
    } catch {
      // quota or private mode — recovery falls back to peer snapshot
    }
  }

  private authorityTarget(): string | null {
    return getAuthorityId(this.engine.getState());
  }

  private isHostPresentInRoom(): boolean {
    const hostId = this.engine.getState().hostId;
    if (!hostId) return false;
    if (hostId === this.playerId) return true;
    return this.knownPeers.has(hostId);
  }

  private syncAuthorityFromState() {
    const state = this.engine.getState();
    this.hostId = state.hostId;
    if (this.recoveringHost) {
      this.isAuthority = false;
      return;
    }
    const hostId = state.hostId;
    if (!hostId) {
      this.isAuthority = false;
      return;
    }
    if (hostId !== this.playerId) {
      this.isAuthority = false;
      return;
    }
    const hostPlayer = state.players.find((p) => p.id === hostId);
    const hostConnected = hostPlayer ? hostPlayer.connected : true;
    this.isAuthority = hostConnected;
  }

  private notePeer(peerId: string, name: string) {
    if (peerId !== this.playerId) this.knownPeers.set(peerId, name);
  }

  private handleSignalingMessage(msg: ServerToClient) {
    switch (msg.type) {
      case "joined": {
        for (const peer of msg.peers) this.notePeer(peer.peerId, peer.name);
        const state = this.engine.getState();

        if (state.phase !== "lobby") {
          if (this.recoveringHost) {
            for (const peer of msg.peers) this.ensureLinkAsAnswerer(peer.peerId);
          } else if (state.hostId === this.playerId) {
            this.syncAuthorityFromState();
            for (const peer of msg.peers) this.ensureLinkAsAnswerer(peer.peerId);
            if (state.paused) this.resumeAsHost();
          } else {
            this.refreshHostLinks();
          }
        } else {
          this.refreshLobbyLinks();
        }
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "peer-joined": {
        this.notePeer(msg.peerId, msg.name);
        if (this.engine.getState().phase === "lobby") {
          this.refreshLobbyLinks();
        } else if (this.isAuthority) {
          this.ensureLinkAsAnswerer(msg.peerId);
        } else {
          this.refreshHostLinks();
        }
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "peer-left": {
        this.knownPeers.delete(msg.peerId);
        this.links.get(msg.peerId)?.close();
        this.links.delete(msg.peerId);
        this.peerStatus.delete(msg.peerId);

        const state = this.engine.getState();
        if (msg.peerId === state.hostId) {
          if (state.phase === "lobby") {
            this.syncAuthorityFromState();
            this.emit({ type: "hostLeft" });
          } else {
            this.engine.apply({ type: "PlayerLeft", playerId: msg.peerId });
            this.applyLocalPause();
          }
        } else if (this.isAuthority) {
          this.handlePeerDisconnected(msg.peerId);
        }
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "signal": {
        const link =
          this.links.get(msg.from) ?? (this.isAuthority ? this.ensureLinkAsAnswerer(msg.from) : null);
        link?.handleSignal(msg.data);
        break;
      }
      case "error":
        this.emit({ type: "error", message: msg.message });
        break;
    }
  }

  /** Wire WebRTC star links in lobby; only the room host is authority. */
  private refreshLobbyLinks() {
    const state = this.engine.getState();
    if (state.phase !== "lobby") return;

    if (!state.hostId) {
      if (this.knownPeers.size === 0) {
        this.seedLobbyAsHost();
      }
      return;
    }

    this.syncAuthorityFromState();

    if (this.isAuthority) {
      for (const [peerId] of this.knownPeers) this.ensureLinkAsAnswerer(peerId);
    } else if (this.isHostPresentInRoom()) {
      this.connectToAuthority(state.hostId!);
    }
  }

  private refreshHostLinks() {
    const hostId = this.authorityTarget();
    if (!hostId) return;
    this.syncAuthorityFromState();
    if (this.isAuthority) {
      for (const [peerId] of this.knownPeers) this.ensureLinkAsAnswerer(peerId);
    } else if (this.isHostPresentInRoom()) {
      this.connectToAuthority(hostId);
    }
  }

  private seedLobbyAsHost() {
    this.engine.apply({ type: "RoomCreated", roomCode: this.roomCode, hostId: this.playerId });
    this.handleIntentAsAuthority({ type: "JoinRoom", playerId: this.playerId, name: this.name }, null);
    this.syncAuthorityFromState();
    this.persistState();
  }

  private applyLocalPause() {
    const events = eventsForHostDisconnect(this.engine.getState());
    if (events.length === 0) return;
    this.engine.applyMany(events);
    this.syncAuthorityFromState();
    this.persistState();
    this.emit({ type: "hostLeft" });
  }

  private handleSignalingDisconnect() {
    const state = this.engine.getState();
    if (state.hostId !== this.playerId || state.phase !== "playing") return;
    if (!state.players.some((p) => p.id === this.playerId && p.connected)) return;
    this.engine.apply({ type: "PlayerLeft", playerId: this.playerId });
    this.applyLocalPause();
  }

  private resumeAsHost() {
    const state = this.engine.getState();
    if (state.hostId !== this.playerId || !state.paused) return;
    const hostPlayer = state.players.find((p) => p.id === this.playerId);
    const events: GameEvent[] = [];
    if (hostPlayer) {
      events.push({ type: "PlayerJoined", player: { ...hostPlayer, connected: true } });
    }
    events.push({ type: "GameResumed" });
    this.engine.applyMany(events);
    this.syncAuthorityFromState();
    this.persistState();
    this.broadcastEvents(events);
    this.emit({ type: "hostReconnected" });
  }

  private connectToAuthority(authorityId: string) {
    if (authorityId === this.playerId) return;
    if (this.peerStatus.get(authorityId) === "connected") return;
    if (this.peerStatus.get(authorityId) === "connecting") return;

    this.links.get(authorityId)?.close();
    this.links.delete(authorityId);
    this.peerStatus.delete(authorityId);

    const link = new PeerLink({
      peerId: authorityId,
      iceServers: this.iceServers,
      onSignal: (data) => this.signaling.send({ type: "signal", to: authorityId, data }),
      onMessage: (msg) => this.handlePeerMessage(authorityId, msg),
      onStatus: (status) => this.handleLinkStatus(authorityId, status),
    });
    this.links.set(authorityId, link);
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

    const authorityId = this.authorityTarget();

    if (!this.isAuthority && status === "connected" && authorityId && peerId === authorityId) {
      this.sendIntent({ type: "JoinRoom", playerId: this.playerId, name: this.name });
    }

    if (this.recoveringHost && status === "connected" && !this.snapshotRequested) {
      this.snapshotRequested = true;
      this.links.get(peerId)?.send({ kind: "snapshot-request" });
    }

    if (status === "disconnected") {
      this.links.delete(peerId);
      if (this.isAuthority) this.handlePeerDisconnected(peerId);
      if (!this.isAuthority && authorityId && peerId === authorityId) {
        this.peerStatus.delete(peerId);
        if (this.isHostPresentInRoom()) this.connectToAuthority(authorityId);
      }
    }
  }

  private finishHostRecovery(state: GameState) {
    const wasPaused = state.paused;
    this.engine.apply({ type: "StateSnapshot", state });
    this.recoveringHost = false;
    if (wasPaused) {
      const hostPlayer = state.players.find((p) => p.id === this.playerId);
      const events: GameEvent[] = [];
      if (hostPlayer) {
        events.push({ type: "PlayerJoined", player: { ...hostPlayer, connected: true } });
      }
      events.push({ type: "GameResumed" });
      this.engine.applyMany(events);
      this.broadcastEvents(events);
    }
    this.syncAuthorityFromState();
    this.persistState();
    this.emit({ type: "hostReconnected" });
  }

  private handlePeerMessage(fromPeerId: string, msg: PeerMessage) {
    if (msg.kind === "intent" && this.isAuthority) {
      this.handleIntentAsAuthority(msg.intent, fromPeerId);
    } else if (msg.kind === "snapshot-request") {
      const snapshot: GameEvent = { type: "StateSnapshot", state: this.engine.getState() };
      this.links.get(fromPeerId)?.send({ kind: "events", events: [snapshot] });
    } else if (msg.kind === "snapshot-response" && this.recoveringHost) {
      this.finishHostRecovery(msg.state);
    } else if (msg.kind === "events" && this.recoveringHost) {
      const snapshot = msg.events.find((e) => e.type === "StateSnapshot");
      if (snapshot && snapshot.type === "StateSnapshot") {
        this.finishHostRecovery(snapshot.state);
      } else {
        this.engine.applyMany(msg.events);
        this.syncAuthorityFromState();
      }
    } else if (msg.kind === "events") {
      this.engine.applyMany(msg.events);
      this.syncAuthorityFromState();
      for (const event of msg.events) {
        if (event.type === "HostTransferred") {
          this.refreshHostLinks();
        }
        if (event.type === "GameResumed") {
          this.emit({ type: "hostReconnected" });
        }
      }
    } else if (msg.kind === "ping") {
      this.links.get(fromPeerId)?.send({ kind: "pong", t: msg.t });
    } else if (msg.kind === "error") {
      this.emit({ type: "error", message: msg.reason });
    }
  }

  private handleIntentAsAuthority(intent: Intent, sourcePeerId: string | null) {
    const result = processIntent(this.engine.getState(), intent);
    if (!result.ok) {
      if (sourcePeerId) this.links.get(sourcePeerId)?.send({ kind: "error", reason: result.reason });
      else this.emit({ type: "error", message: result.reason });
      return;
    }
    if (result.events.length > 0) {
      this.engine.applyMany(result.events);
      this.syncAuthorityFromState();
      this.persistState();
      this.broadcastEvents(result.events);

      for (const event of result.events) {
        if (event.type === "HostTransferred") {
          this.refreshHostLinks();
        }
        if (event.type === "GameResumed") {
          this.emit({ type: "hostReconnected" });
        }
      }
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
    if (!this.isAuthority) return;
    const state = this.engine.getState();
    if (!state.players.some((p) => p.id === peerId && p.connected)) return;
    const events: GameEvent[] = [{ type: "PlayerLeft", playerId: peerId }];
    this.engine.applyMany(events);
    this.persistState();
    this.broadcastEvents(events);

    if (peerId === state.hostId) {
      this.applyLocalPause();
    }
  }

  private broadcastEvents(events: GameEvent[]) {
    for (const link of this.links.values()) {
      link.send({ kind: "events", events });
    }
  }

  private startKeepalive() {
    if (typeof document === "undefined") return;
    this.keepaliveTimer = setInterval(() => {
      const t = Date.now();
      for (const link of this.links.values()) {
        link.send({ kind: "ping", t });
      }
    }, KEEPALIVE_MS);
  }

  private stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private bindVisibilityReconnect() {
    if (typeof document === "undefined") return;
    this.visibilityHandler = () => {
      if (document.visibilityState !== "visible") return;
      this.reconnectStaleLinks();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private unbindVisibilityReconnect() {
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private reconnectStaleLinks() {
    if (this.isAuthority) return;
    const authorityId = this.authorityTarget();
    if (!authorityId || !this.isHostPresentInRoom()) return;
    const status = this.peerStatus.get(authorityId);
    if (status !== "connected") {
      this.connectToAuthority(authorityId);
    }
  }
}
