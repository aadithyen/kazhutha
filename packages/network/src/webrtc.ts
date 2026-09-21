import { emitTelemetry, type ClientEventType } from "@kazhutha/observability";
import { summarizeRtcStats } from "@kazhutha/observability/webrtc-stats";
import { DEFAULT_ICE_SERVERS, PeerMessage, SignalPayload } from "./types";

export interface PeerLinkOptions {
  peerId: string;
  iceServers?: RTCIceServer[];
  roomCode?: string;
  traceId?: string;
  clientVersion?: string;
  onSignal: (data: SignalPayload) => void;
  onMessage: (msg: PeerMessage) => void;
  onStatus: (status: "connecting" | "connected" | "disconnected") => void;
}

const DISCONNECT_GRACE_MS = 4000;
const FLUSH_TIMEOUT_MS = 1000;
const STATS_INTERVAL_MS = 8_000;

/** One WebRTC connection + reliable/ordered DataChannel to a single remote peer. */
export class PeerLink {
  readonly peerId: string;
  private pc: RTCPeerConnection;
  private opts: PeerLinkOptions;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;
  private outbox: PeerMessage[] = [];
  private closed = false;
  private reportedDown = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private createdAt = Date.now();
  private reconnectCount = 0;
  private lastCandidateType: "host" | "srflx" | "relay" | "unknown" = "unknown";
  private connectedAt: number | null = null;

  constructor(opts: PeerLinkOptions) {
    this.opts = opts;
    this.peerId = opts.peerId;
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS });
    this.trackClient("peer_connection_created", { remote_peer_id: opts.peerId });

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.opts.onSignal({ kind: "candidate", candidate: ev.candidate.toJSON() });
    };
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      if (state === "failed") {
        this.trackClient("ice_failed", {
          ice_connection_state: state,
          candidate_type: this.lastCandidateType,
        });
      } else if (state === "disconnected") {
        this.trackClient("ice_restart", { ice_connection_state: state });
      }
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "failed" || state === "closed") {
        this.trackClient(state === "failed" ? "connection_failed" : "connection_closed", {
          connection_state: state,
          ice_connection_state: this.pc.iceConnectionState,
          candidate_type: this.lastCandidateType,
          connection_duration_ms: this.connectedAt ? Date.now() - this.connectedAt : undefined,
          disconnect_reason: state,
        });
        this.reportDown();
      } else if (state === "disconnected") {
        this.startGrace();
      } else if (state === "connected") {
        this.cancelGrace();
        if (!this.connectedAt) {
          this.connectedAt = Date.now();
          this.trackClient("connection_established", {
            connection_state: state,
            establishment_duration_ms: Date.now() - this.createdAt,
            candidate_type: this.lastCandidateType,
          });
        }
        this.startStatsSampler();
      }
    };
    this.pc.ondatachannel = (ev) => {
      this.bindChannel(ev.channel);
    };
  }

  /** Call on the side that should send the SDP offer (the joining client). */
  async createOffer() {
    try {
      const channel = this.pc.createDataChannel("game", { ordered: true });
      this.bindChannel(channel);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.opts.onSignal({ kind: "offer", sdp: offer.sdp ?? "" });
    } catch (err) {
      this.trackClient("webrtc_error", {
        error_message: err instanceof Error ? err.message : "createOffer failed",
        connection_state: this.pc.connectionState,
      });
      this.reportDown();
    }
  }

  async handleSignal(data: SignalPayload) {
    try {
      if (data.kind === "offer") {
        await this.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        this.remoteDescSet = true;
        await this.flushCandidates();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.opts.onSignal({ kind: "answer", sdp: answer.sdp ?? "" });
      } else if (data.kind === "answer") {
        await this.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        this.remoteDescSet = true;
        await this.flushCandidates();
      } else if (data.kind === "candidate") {
        if (this.remoteDescSet) {
          await this.pc.addIceCandidate(data.candidate).catch(() => {});
        } else {
          this.pendingCandidates.push(data.candidate);
        }
      }
    } catch (err) {
      if (data.kind !== "candidate") {
        this.trackClient("webrtc_error", {
          error_message: err instanceof Error ? err.message : "signal handling failed",
          signal_kind: data.kind,
        });
        this.reportDown();
      }
    }
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      await this.pc.addIceCandidate(c).catch(() => {});
    }
  }

  private bindChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => {
      const queued = this.outbox;
      this.outbox = [];
      for (const msg of queued) this.send(msg);
      this.cancelGrace();
      this.opts.onStatus("connected");
    };
    channel.onclose = () => this.reportDown();
    channel.onmessage = (ev) => {
      try {
        this.opts.onMessage(JSON.parse(ev.data) as PeerMessage);
      } catch {
        // ignore malformed frames
      }
    };
  }

  private channel: RTCDataChannel | null = null;

  private startGrace() {
    if (this.graceTimer !== null || this.closed) return;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      if (this.pc.connectionState !== "connected") this.reportDown();
    }, DISCONNECT_GRACE_MS);
  }

  private cancelGrace() {
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  private reportDown() {
    this.cancelGrace();
    this.stopStatsSampler();
    if (this.reportedDown) return;
    this.reportedDown = true;
    this.opts.onStatus("disconnected");
  }

  private startStatsSampler() {
    if (this.statsTimer !== null) return;
    this.statsTimer = setInterval(() => void this.sampleStats(), STATS_INTERVAL_MS);
  }

  private stopStatsSampler() {
    if (this.statsTimer !== null) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private async sampleStats() {
    if (this.closed || this.pc.connectionState !== "connected") return;
    try {
      const report = await this.pc.getStats();
      const sample = summarizeRtcStats(report);
      sample.connectionState = this.pc.connectionState;
      sample.iceConnectionState = this.pc.iceConnectionState;
      this.lastCandidateType = sample.candidateType;
      this.trackClient("webrtc_stats_sample", {
        connection_state: sample.connectionState,
        ice_connection_state: sample.iceConnectionState,
        candidate_type: sample.candidateType,
        protocol: sample.protocol,
        rtt_ms: sample.rttMs,
        packet_loss: sample.packetLoss,
        jitter_ms: sample.jitterMs,
        bytes_sent: sample.bytesSent,
        bytes_received: sample.bytesReceived,
        connection_duration_ms: this.connectedAt ? Date.now() - this.connectedAt : undefined,
        reconnect_count: this.reconnectCount,
      });
    } catch {
      // stats sampling is best-effort
    }
  }

  private trackClient(eventType: ClientEventType, fields: Record<string, unknown> = {}) {
    emitTelemetry({
      stream: "client_events",
      body: {
        timestamp: new Date().toISOString(),
        stream: "client_events",
        event_type: eventType,
        service: "kazhutha-web",
        environment: "browser",
        version: this.opts.clientVersion ?? "0.1.0",
        trace_id: this.opts.traceId,
        session_id: this.opts.roomCode,
        room_code: this.opts.roomCode,
        peer_id: this.opts.peerId,
        remote_peer_id: this.peerId,
        ...fields,
      },
    });
  }

  markReconnect() {
    this.reconnectCount += 1;
    this.trackClient("peer_reconnected", { reconnect_count: this.reconnectCount });
  }

  send(msg: PeerMessage) {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify(msg));
      return;
    }
    this.outbox.push(msg);
  }

  close() {
    this.closed = true;
    this.cancelGrace();
    this.stopStatsSampler();
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      // already closed
    }
  }

  closeWhenFlushed() {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open" || channel.bufferedAmount === 0) {
      this.close();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      channel.onbufferedamountlow = null;
      this.close();
    };
    channel.bufferedAmountLowThreshold = 0;
    channel.onbufferedamountlow = finish;
    setTimeout(finish, FLUSH_TIMEOUT_MS);
  }
}
