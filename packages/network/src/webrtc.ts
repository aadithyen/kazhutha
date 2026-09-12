import { DEFAULT_ICE_SERVERS, PeerMessage, SignalPayload } from "./types";

export interface PeerLinkOptions {
  peerId: string;
  iceServers?: RTCIceServer[];
  onSignal: (data: SignalPayload) => void;
  onMessage: (msg: PeerMessage) => void;
  onStatus: (status: "connecting" | "connected" | "disconnected") => void;
}

/**
 * ICE "disconnected" is transient (often recovers within seconds on mobile
 * networks); only report it if the connection has not come back by then.
 */
const DISCONNECT_GRACE_MS = 4000;
/** Upper bound on waiting for buffered DataChannel bytes to drain before close. */
const FLUSH_TIMEOUT_MS = 1000;

/** One WebRTC connection + reliable/ordered DataChannel to a single remote peer. */
export class PeerLink {
  readonly peerId: string;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private opts: PeerLinkOptions;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;
  private outbox: PeerMessage[] = [];
  private closed = false;
  private reportedDown = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: PeerLinkOptions) {
    this.opts = opts;
    this.peerId = opts.peerId;
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS });
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.opts.onSignal({ kind: "candidate", candidate: ev.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "failed" || state === "closed") {
        this.reportDown();
      } else if (state === "disconnected") {
        this.startGrace();
      } else if (state === "connected") {
        this.cancelGrace();
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
    } catch {
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
    } catch {
      // Bad SDP or a signal for a stale negotiation; the peer will re-offer.
      if (data.kind !== "candidate") this.reportDown();
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
    if (this.reportedDown) return;
    this.reportedDown = true;
    this.opts.onStatus("disconnected");
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
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      // already closed
    }
  }

  /**
   * Close once queued outbound bytes have left the local buffer, so a final
   * broadcast (e.g. HostTransferred) is not dropped by an immediate close.
   */
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
