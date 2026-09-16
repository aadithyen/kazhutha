import { setTelemetryHandler } from "./emitter.js";
import { createTraceId } from "./correlation.js";
import { sanitizeTelemetryPayload } from "./sanitize.js";
import type { ClientTelemetryEvent, ClientEventType } from "./types.js";

export interface BrowserTelemetryConfig {
  enabled: boolean;
  endpoint: string;
  service: string;
  environment: string;
  version: string;
  flushIntervalMs: number;
  maxBatchSize: number;
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Chrome")) return "chrome";
  if (ua.includes("Safari")) return "safari";
  return "other";
}

export function detectOs(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "windows";
  if (ua.includes("Mac OS")) return "macos";
  if (ua.includes("Android")) return "android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "ios";
  if (ua.includes("Linux")) return "linux";
  return "other";
}

export class BrowserTelemetryReporter {
  private queue: ClientTelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private traceId = createTraceId();
  private sessionId?: string;
  private peerId?: string;
  private roomCode?: string;
  private active = false;

  constructor(private readonly config: BrowserTelemetryConfig) {}

  init(): void {
    if (!this.config.enabled) return;
    setTelemetryHandler((record) => {
      if (record.stream === "client_events") {
        this.enqueue(record.body as ClientTelemetryEvent);
      }
    });
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
    window.addEventListener("error", (ev) => {
      this.track("frontend_error", {
        error_message: ev.message,
        error_stack: ev.error instanceof Error ? ev.error.stack : undefined,
        route: window.location.pathname,
      });
    });
    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev.reason;
      this.track("frontend_error", {
        error_message: reason instanceof Error ? reason.message : String(reason),
        error_stack: reason instanceof Error ? reason.stack : undefined,
        route: window.location.pathname,
      });
    });
    document.addEventListener("visibilitychange", () => {
      this.active = document.visibilityState === "visible";
    });
    this.active = document.visibilityState === "visible";
  }

  setContext(ctx: { sessionId?: string; peerId?: string; roomCode?: string; traceId?: string }): void {
    if (ctx.traceId) this.traceId = ctx.traceId;
    if (ctx.sessionId) this.sessionId = ctx.sessionId;
    if (ctx.peerId) this.peerId = ctx.peerId;
    if (ctx.roomCode) this.roomCode = ctx.roomCode;
  }

  track(eventType: ClientEventType, fields: Record<string, unknown> = {}): void {
    if (!this.config.enabled) return;
    if (!this.active && eventType === "webrtc_stats_sample") return;
    const event: ClientTelemetryEvent = sanitizeTelemetryPayload({
      timestamp: new Date().toISOString(),
      stream: "client_events",
      event_type: eventType,
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      trace_id: this.traceId,
      session_id: this.sessionId ?? this.roomCode,
      peer_id: this.peerId,
      room_code: this.roomCode,
      browser: detectBrowser(),
      os: detectOs(),
      route: window.location.pathname,
      ...fields,
    }) as ClientTelemetryEvent;
    this.enqueue(event);
  }

  private enqueue(event: ClientTelemetryEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.config.maxBatchSize) void this.flush();
  }

  async flush(): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.config.maxBatchSize);
    try {
      await fetch(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // drop batch on failure
    }
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    setTelemetryHandler(null);
    void this.flush();
  }
}

export { emitTelemetry, setTelemetryHandler } from "./emitter.js";
export { summarizeRtcStats } from "./webrtc-stats.js";
export type { ClientEventType, ClientTelemetryEvent, TelemetryRecord } from "./types.js";
