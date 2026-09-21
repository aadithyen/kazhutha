import { emitTelemetry, type ClientEventType } from "@kazhutha/observability";
import { ClientToServer, ServerToClient } from "./types";

type Handler = (msg: ServerToClient) => void;

export interface SignalingClientOptions {
  roomCode?: string;
  peerId?: string;
  traceId?: string;
  clientVersion?: string;
}

/** Thin WebSocket wrapper for the signalling server, with basic auto-reconnect. */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<(connected: boolean) => void>();
  private closedByUser = false;
  private retryDelay = 1000;
  private joinPayload: ClientToServer | null = null;
  private reconnectCount = 0;
  private opts: SignalingClientOptions;

  constructor(
    private url: string,
    opts: SignalingClientOptions = {},
  ) {
    this.opts = opts;
  }

  connect(joinPayload: ClientToServer) {
    this.closedByUser = false;
    this.joinPayload = joinPayload;
    if (joinPayload.type === "join") {
      this.opts.roomCode = joinPayload.roomCode;
      this.opts.peerId = joinPayload.peerId;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(joinPayload);
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) return;
    this.open();
  }

  private open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retryDelay = 1000;
      if (this.joinPayload) this.send(this.joinPayload);
      this.track(this.reconnectCount > 0 ? "signaling_reconnect" : "signaling_connected", {
        reconnect_count: this.reconnectCount,
      });
      this.statusHandlers.forEach((h) => h(true));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerToClient;
        this.handlers.forEach((h) => h(msg));
      } catch {
        this.track("signaling_error", { error_message: "malformed server message" });
      }
    };
    ws.onclose = () => {
      this.track("signaling_disconnected", { reconnect_count: this.reconnectCount });
      this.statusHandlers.forEach((h) => h(false));
      if (!this.closedByUser) {
        this.reconnectCount += 1;
        setTimeout(() => this.open(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 15000);
      }
    };
    ws.onerror = () => {
      this.track("signaling_error", { error_message: "websocket error" });
      ws.close();
    };
  }

  private track(eventType: ClientEventType, fields: Record<string, unknown> = {}) {
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
        ...fields,
      },
    });
  }

  send(msg: ClientToServer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: (connected: boolean) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
