import {
  GameEngine,
  GameEvent,
  GameState,
  Intent,
  eventsForHostDisconnect,
  getAuthorityId,
  processIntent,
} from "@kazhutha/game";
import { electLobbyHost } from "./lobbyHost";
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
  | { type: "actingHost"; actingHostId: string }
  | { type: "signalingStatus"; connected: boolean };

type Handler = (ev: RoomClientEvent) => void;

const STATE_PREFIX = "kazhutha:state:";

/**
 * Star-topology P2P room: every peer opens one WebRTC DataChannel to the
 * current authority (host or acting host). The authority runs the game engine
 * and broadcasts events; every client applies the same events through the
 * identical reducer.
 *
 * Lobby host is chosen peer-to-peer: earliest joiner still present wins.
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
  private joinOrder: string[] = [];
  private electedHostId: string | null = null;
  private peerStatus = new Map<string, PeerConnectionStatus>();
  private handlers = new Set<Handler>();
  private iceServers?: RTCIceServer[];
  private recoveringHost = false;
  private snapshotRequested = false;

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
    this.signaling.onStatus((connected) => this.emit({ type: "signalingStatus", connected }));
    this.syncAuthorityFromState();
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
    this.signaling.close();
    for (const link of this.links.values()) link.close();
    this.links.clear();
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

  private presentPeerIds(): Set<string> {
    return new Set([this.playerId, ...this.knownPeers.keys()]);
  }

  private lobbyHostId(): string {
    return electLobbyHost(this.playerId, this.joinOrder, this.presentPeerIds());
  }

  private authorityTarget(): string | null {
    const state = this.engine.getState();
    if (state.phase === "lobby") return this.lobbyHostId();
    return getAuthorityId(state);
  }

  private syncAuthorityFromState() {
    const state = this.engine.getState();
    this.hostId = state.hostId;
    if (this.recoveringHost) {
      this.isAuthority = false;
      return;
    }
    if (state.phase === "lobby") {
      this.isAuthority = this.lobbyHostId() === this.playerId;
      return;
    }
    const authorityId = getAuthorityId(state);
    this.isAuthority = authorityId === this.playerId;
  }

  private notePeer(peerId: string, name: string) {
    if (peerId !== this.playerId) this.knownPeers.set(peerId, name);
    if (!this.joinOrder.includes(peerId)) this.joinOrder.push(peerId);
  }

  private handleSignalingMessage(msg: ServerToClient) {
    switch (msg.type) {
      case "joined": {
        for (const peer of msg.peers) this.notePeer(peer.peerId, peer.name);
        this.notePeer(this.playerId, this.name);
        const state = this.engine.getState();

        if (state.phase !== "lobby") {
          if (state.hostId === this.playerId) {
            this.recoveringHost = true;
            this.syncAuthorityFromState();
            for (const peer of msg.peers) this.ensureLinkAsAnswerer(peer.peerId);
            if (!state.hostId) this.seedLobbyAsHost();
          } else {
            this.connectToAuthority(getAuthorityId(state) ?? this.lobbyHostId());
          }
        } else {
          this.refreshLobbyAuthority();
        }
        this.emit({ type: "peers", peers: this.getPeers() });
        break;
      }
      case "peer-joined": {
        this.notePeer(msg.peerId, msg.name);
        if (this.engine.getState().phase === "lobby") {
          this.refreshLobbyAuthority();
        } else if (this.isAuthority) {
          this.ensureLinkAsAnswerer(msg.peerId);
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
        if (state.phase === "lobby") {
          const prevHost = this.electedHostId;
          this.refreshLobbyAuthority();
          if (this.isAuthority && state.players.some((p) => p.id === msg.peerId && p.connected)) {
            const events: GameEvent[] = [{ type: "PlayerLeft", playerId: msg.peerId }];
            this.engine.applyMany(events);
            this.persistState();
            this.broadcastEvents(events);
          } else if (prevHost === msg.peerId) {
            this.emit({ type: "hostLeft" });
          }
        } else if (msg.peerId === state.hostId) {
          this.engine.apply({ type: "PlayerLeft", playerId: msg.peerId });
          this.applyLocalElection();
          this.emit({ type: "hostLeft" });
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

  /** Recompute P2P lobby host, seed state if needed, wire WebRTC star links. */
  private refreshLobbyAuthority() {
    const state = this.engine.getState();
    if (state.phase !== "lobby") return;

    const hostId = this.lobbyHostId();
    const prevHost = this.electedHostId;
    this.electedHostId = hostId;
    this.syncAuthorityFromState();

    if (prevHost && prevHost !== hostId) {
      this.handleAuthorityTargetChanged(hostId);
    }

    if (this.isAuthority) {
      this.ensureLobbyHostState();
      for (const [peerId] of this.knownPeers) this.ensureLinkAsAnswerer(peerId);
    } else {
      this.connectToAuthority(hostId);
    }
  }

  private ensureLobbyHostState() {
    const state = this.engine.getState();
    if (!state.hostId) {
      this.seedLobbyAsHost();
      return;
    }
    if (state.hostId !== this.playerId) {
      const transfer: GameEvent = { type: "HostTransferred", newHostId: this.playerId };
      this.engine.apply(transfer);
      this.persistState();
      this.broadcastEvents([transfer]);
    }
  }

  private seedLobbyAsHost() {
    this.engine.apply({ type: "RoomCreated", roomCode: this.roomCode, hostId: this.playerId });
    this.handleIntentAsAuthority({ type: "JoinRoom", playerId: this.playerId, name: this.name }, null);
    this.syncAuthorityFromState();
    this.persistState();
  }

  private applyLocalElection() {
    const events = eventsForHostDisconnect(this.engine.getState());
    if (events.length === 0) return;
    this.engine.applyMany(events);
    this.persistState();
    const elected = events.find((e) => e.type === "ActingHostElected");
    if (elected && elected.type === "ActingHostElected") {
      this.emit({ type: "actingHost", actingHostId: elected.actingHostId });
      this.handleAuthorityTargetChanged(elected.actingHostId);
    }
  }

  private handleAuthorityTargetChanged(newAuthorityId: string) {
    if (newAuthorityId === this.playerId) {
      this.syncAuthorityFromState();
      if (this.engine.getState().phase === "lobby") {
        this.ensureLobbyHostState();
      }
      for (const [peerId] of this.knownPeers) {
        if (peerId !== this.playerId) this.ensureLinkAsAnswerer(peerId);
      }
      return;
    }
    this.syncAuthorityFromState();
    this.rewireToAuthority(newAuthorityId);
  }

  private rewireToAuthority(authorityId: string) {
    for (const [peerId, link] of this.links) {
      if (peerId !== authorityId) {
        link.close();
        this.links.delete(peerId);
        this.peerStatus.delete(peerId);
      }
    }
    this.connectToAuthority(authorityId);
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
        this.connectToAuthority(authorityId);
      }
    }
  }

  private finishHostRecovery(state: GameState) {
    this.engine.apply({ type: "StateSnapshot", state });
    this.recoveringHost = false;
    this.syncAuthorityFromState();
    if (state.actingHostId) {
      const release: GameEvent[] = [{ type: "ActingHostReleased" }];
      this.engine.applyMany(release);
      this.broadcastEvents(release);
    }
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
          this.handleAuthorityTargetChanged(event.newHostId);
        }
      }
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
          this.handleAuthorityTargetChanged(event.newHostId);
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
      this.applyLocalElection();
    }
  }

  private broadcastEvents(events: GameEvent[]) {
    for (const link of this.links.values()) {
      link.send({ kind: "events", events });
    }
  }
}
