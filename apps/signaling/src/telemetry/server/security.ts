import type { SecurityEvent, SecurityEventType } from "../types.js";
import type { ObservabilityConfig } from "./config.js";
import { hashSourceSync } from "./hash.js";
import { createTraceId } from "../correlation.js";

type SecuritySink = (event: SecurityEvent) => void;

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;
const FLOOD_THRESHOLD = 30;

export class SecurityTracker {
  private sinks: SecuritySink[] = [];
  private windows = new Map<string, WindowEntry>();

  constructor(private readonly config: ObservabilityConfig) {}

  addSink(sink: SecuritySink): void {
    this.sinks.push(sink);
  }

  hashSource(source: string): string {
    return hashSourceSync(source, this.config.ipHashSalt);
  }

  record(
    type: SecurityEventType,
    message: string,
    opts: {
      source?: string;
      route?: string;
      sessionId?: string;
      peerId?: string;
      detail?: string;
      traceId?: string;
    } = {},
  ): void {
    if (!this.config.enabled) return;
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      stream: "security_events",
      security_event_type: type,
      message,
      service: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version,
      trace_id: opts.traceId ?? createTraceId(),
      session_id: opts.sessionId,
      peer_id: opts.peerId,
      route: opts.route,
      source_hash: opts.source ? this.hashSource(opts.source) : undefined,
      detail: opts.detail,
    };
    for (const sink of this.sinks) {
      try {
        sink(event);
      } catch {
        // ignore
      }
    }
  }

  /** Track request volume per hashed source; emit connection_flood when threshold exceeded. */
  trackRequest(source: string, route: string, traceId?: string): void {
    const key = `${this.hashSource(source)}:${route}`;
    const now = Date.now();
    const entry = this.windows.get(key);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.windows.set(key, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
    if (entry.count === FLOOD_THRESHOLD) {
      this.record("connection_flood", "Excessive requests from source", {
        source,
        route,
        traceId,
        detail: `${entry.count} requests in ${WINDOW_MS / 1000}s`,
      });
    }
  }
}
