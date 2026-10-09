import { createServerObservability, type ServerObservability } from "./telemetry/server/index.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const obs: ServerObservability = createServerObservability();

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function trackHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  start: number,
  traceId: string,
): void {
  const durationMs = Date.now() - start;
  const method = req.method ?? "GET";
  const statusCode = res.statusCode;

  obs.security.trackRequest(clientIp(req), route, traceId);

  const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  obs.logger.log(level, "HTTP request", {
    traceId,
    route,
    method,
    statusCode,
    durationMs,
    securityEventType: statusCode === 403 ? "unauthorized_access" : undefined,
  });

  if (statusCode === 403) {
    obs.security.record("unauthorized_access", "Forbidden request", {
      source: clientIp(req),
      route,
      traceId,
    });
  }
}
