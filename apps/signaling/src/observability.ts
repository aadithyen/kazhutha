import { createServerObservability, type ServerObservability } from "./telemetry/server/index.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClientTelemetryEvent } from "./telemetry/types.js";

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
  const labels = { method, route, status_code: String(statusCode) };

  obs.metrics?.httpRequestsTotal.add(1, labels);
  obs.metrics?.httpRequestDuration.record(durationMs, labels);
  if (statusCode >= 400) obs.metrics?.httpErrorsTotal.add(1, labels);

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

export async function handleTelemetryIngest(
  req: IncomingMessage,
  res: ServerResponse,
  allowOrigin: string | null,
): Promise<void> {
  if (!allowOrigin) {
    res.writeHead(403);
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");

  let events: ClientTelemetryEvent[] = [];
  try {
    const parsed = JSON.parse(raw) as { events?: ClientTelemetryEvent[] };
    if (Array.isArray(parsed.events)) events = parsed.events;
  } catch {
    obs.security.record("invalid_request", "Malformed telemetry payload", {
      source: clientIp(req),
      route: "/telemetry",
    });
    res.writeHead(400);
    res.end();
    return;
  }

  if (events.length > 50) events = events.slice(0, 50);
  obs.ingest.sendClientEvents(events);
  res.writeHead(204, { "access-control-allow-origin": allowOrigin, vary: "origin" });
  res.end();
}
