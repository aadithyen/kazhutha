import type { LogLevel, StructuredLog } from "../types.js";
import type { ObservabilityConfig } from "./config.js";
import { createTraceId } from "../correlation.js";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogContext {
  traceId?: string;
  sessionId?: string;
  peerId?: string;
  roomCode?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  securityEventType?: StructuredLog["security_event_type"];
  error?: unknown;
  [key: string]: unknown;
}

type LogSink = (entry: StructuredLog) => void;

export class StructuredLogger {
  private sinks: LogSink[] = [];

  constructor(private readonly config: ObservabilityConfig) {}

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.config.logLevel];
  }

  log(level: LogLevel, message: string, ctx: LogContext = {}): void {
    if (!this.config.enabled || !this.shouldLog(level)) return;
    const entry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stream: "application_logs",
      service: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version,
      trace_id: ctx.traceId ?? createTraceId(),
      session_id: ctx.sessionId ?? ctx.roomCode,
      peer_id: ctx.peerId,
      room_code: ctx.roomCode,
      route: ctx.route,
      method: ctx.method,
      status_code: ctx.statusCode,
      duration_ms: ctx.durationMs,
      security_event_type: ctx.securityEventType,
    };
    if (ctx.error instanceof Error) {
      entry.error_name = ctx.error.name;
      entry.error_message = ctx.error.message;
    } else if (typeof ctx.error === "string") {
      entry.error_message = ctx.error;
    }
    for (const [key, value] of Object.entries(ctx)) {
      if (
        ["traceId", "sessionId", "peerId", "roomCode", "route", "method", "statusCode", "durationMs", "securityEventType", "error"].includes(key)
      ) {
        continue;
      }
      if (value !== undefined) entry[key] = value;
    }
    for (const sink of this.sinks) {
      try {
        sink(entry);
      } catch {
        // ignore sink failures
      }
    }
  }

  debug(message: string, ctx?: LogContext): void {
    this.log("debug", message, ctx);
  }
  info(message: string, ctx?: LogContext): void {
    this.log("info", message, ctx);
  }
  warn(message: string, ctx?: LogContext): void {
    this.log("warn", message, ctx);
  }
  error(message: string, ctx?: LogContext): void {
    this.log("error", message, ctx);
  }
}
