import { ClientToServer, ServerToClient } from "./types";

type Handler = (msg: ServerToClient) => void;

/** Thin WebSocket wrapper for the signalling server, with basic auto-reconnect. */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<(connected: boolean) => void>();
  private closedByUser = false;
  private retryDelay = 1000;
  private joinPayload: ClientToServer | null = null;

  constructor(private url: string) {}

  connect(joinPayload: ClientToServer) {
    this.closedByUser = false;
    this.joinPayload = joinPayload;
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
      this.statusHandlers.forEach((h) => h(true));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerToClient;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      this.statusHandlers.forEach((h) => h(false));
      if (!this.closedByUser) {
        setTimeout(() => this.open(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 15000);
      }
    };
    ws.onerror = () => {
      ws.close();
    };
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
