import { DEFAULT_ICE_SERVERS, PeerMessage, SignalPayload } from "./types";

export interface PeerLinkOptions {
  peerId: string;
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  onSignal: (data: SignalPayload) => void;
  onMessage: (msg: PeerMessage) => void;
  onStatus: (status: "connecting" | "connected" | "disconnected" | "failed") => void;
}

/** One WebRTC connection + reliable/ordered DataChannel to a single remote peer. */
export class PeerLink {
  readonly peerId: string;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private opts: PeerLinkOptions;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;
  private outbox: PeerMessage[] = [];
  private reportedFailure = false;

  constructor(opts: PeerLinkOptions) {
    this.opts = opts;
    this.peerId = opts.peerId;
    this.pc = new RTCPeerConnection({
      iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS,
      iceTransportPolicy: opts.iceTransportPolicy ?? "all",
    });
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.opts.onSignal({ kind: "candidate", candidate: ev.candidate.toJSON() });
    };
    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === "failed") this.reportPeerFailure();
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "failed") {
        this.reportPeerFailure();
      } else if (state === "disconnected" || state === "closed") {
        this.opts.onStatus("disconnected");
      }
    };
    this.pc.ondatachannel = (ev) => {
      this.bindChannel(ev.channel);
    };
  }

  /** Call on the side that should send the SDP offer (the joining client). */
  async createOffer() {
    const channel = this.pc.createDataChannel("game", { ordered: true });
    this.bindChannel(channel);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.opts.onSignal({ kind: "offer", sdp: offer.sdp ?? "" });
  }

  async handleSignal(data: SignalPayload) {
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
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      await this.pc.addIceCandidate(c).catch(() => {});
    }
  }

  private reportPeerFailure() {
    if (this.reportedFailure) return;
    this.reportedFailure = true;
    this.opts.onStatus("failed");
  }

  private bindChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => {
      const queued = this.outbox;
      this.outbox = [];
      for (const msg of queued) this.send(msg);
      this.opts.onStatus("connected");
    };
    channel.onclose = () => this.opts.onStatus("disconnected");
    channel.onmessage = (ev) => {
      try {
        this.opts.onMessage(JSON.parse(ev.data) as PeerMessage);
      } catch {
        // ignore malformed frames
      }
    };
  }

  send(msg: PeerMessage) {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify(msg));
      return;
    }
    this.outbox.push(msg);
  }

  close() {
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      // already closed
    }
  }
}
