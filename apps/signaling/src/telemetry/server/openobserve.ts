import type { ClientTelemetryEvent, SecurityEvent, StructuredLog } from "../types.js";
import type { ObservabilityConfig } from "./config.js";

type IngestPayload = StructuredLog | SecurityEvent | ClientTelemetryEvent;

const EXPORT_ERROR_LOG_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const FLUSH_INTERVAL_MS = 2_000;
const MAX_BATCH_SIZE = 50;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60_000;

interface IngestResponse {
  code?: number;
  status?: Array<{ name?: string; successful?: number; failed?: number }>;
  message?: string;
}

export interface IngestResult {
  ok: boolean;
  status: number | null;
  successful: number;
  failed: number;
  detail: string;
  url: string;
}

/** OpenObserve JSON ingest: {OTEL_EXPORTER_OTLP_ENDPOINT}/{stream}/_json */
export function openObserveIngestUrl(config: ObservabilityConfig, stream: string): string | null {
  if (!config.otlpEndpoint) return null;
  return `${config.otlpEndpoint}/${stream}/_json`;
}

/** Map Kazhutha fields to OpenObserve-friendly ingest records. */
export function toOpenObserveRecords(records: IngestPayload[]): Record<string, unknown>[] {
  return records.map((record) => {
    const copy: Record<string, unknown> = { ...record };
    if (typeof copy.timestamp === "string" && copy._timestamp === undefined) {
      copy._timestamp = copy.timestamp;
    }
    return copy;
  });
}

function parseIngestResponse(body: string): IngestResponse | null {
  try {
    return JSON.parse(body) as IngestResponse;
  } catch {
    return null;
  }
}

function summarizeIngestResponse(status: number, body: string): IngestResult {
  const parsed = parseIngestResponse(body);
  const successful = parsed?.status?.reduce((sum, row) => sum + (row.successful ?? 0), 0) ?? 0;
  const failed = parsed?.status?.reduce((sum, row) => sum + (row.failed ?? 0), 0) ?? 0;
  const ok = status >= 200 && status < 300 && failed === 0;
  const detail =
    parsed?.message ??
    (parsed?.status?.length
      ? parsed.status.map((row) => `${row.name ?? "stream"}: +${row.successful ?? 0}/-${row.failed ?? 0}`).join(", ")
      : body.slice(0, 200) || "empty response body");
  return { ok, status, successful, failed, detail, url: "" };
}

/**
 * Forward JSON records to OpenObserve _json ingest endpoints.
 * Gameplay must not break if export fails; failures log a rate-limited warning.
 */
export class OpenObserveIngest {
  private lastErrorLogAt = 0;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly buffers = new Map<string, IngestPayload[]>();

  constructor(private readonly config: ObservabilityConfig) {}

  hasAuth(): boolean {
    return Object.keys(this.config.otlpHeaders).length > 0;
  }

  private exportConfigured(): boolean {
    return this.config.enabled && !!this.config.otlpEndpoint;
  }

  private circuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private recordFailure(stream: string, result: IngestResult): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && this.circuitOpenUntil === 0) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      this.logExportFailure(stream, {
        ...result,
        detail: `export paused for ${CIRCUIT_COOLDOWN_MS / 60_000}m after repeated failures (${result.detail})`,
      });
      return;
    }
    this.logExportFailure(stream, result);
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  private logExportFailure(stream: string, result: IngestResult): void {
    const now = Date.now();
    if (now - this.lastErrorLogAt < EXPORT_ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLogAt = now;
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        message: "OpenObserve export failed",
        stream,
        status_code: result.status,
        successful: result.successful,
        failed: result.failed,
        detail: result.detail,
        ingest_url: result.url,
        service: this.config.serviceName,
      }),
    );
  }

  async verifyIngest(stream = "application_logs"): Promise<IngestResult> {
    return this.postNow(stream, [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "kazhutha_openobserve_startup_probe",
        stream: "application_logs",
        service: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        route: "/startup",
      },
    ]);
  }

  private enqueue(stream: string, records: IngestPayload[]): void {
    if (!this.exportConfigured() || records.length === 0 || this.circuitOpen()) return;
    const buffer = this.buffers.get(stream) ?? [];
    buffer.push(...records);
    while (buffer.length > MAX_BATCH_SIZE) {
      const batch = buffer.splice(0, MAX_BATCH_SIZE);
      void this.postNow(stream, batch);
    }
    this.buffers.set(stream, buffer);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushAll();
    }, FLUSH_INTERVAL_MS);
  }

  private flushAll(): void {
    for (const [stream, buffer] of this.buffers) {
      if (buffer.length === 0) continue;
      const batch = buffer.splice(0, buffer.length);
      void this.postNow(stream, batch);
    }
  }

  private async postNow(stream: string, records: IngestPayload[]): Promise<IngestResult> {
    const url = openObserveIngestUrl(this.config, stream);
    if (!this.exportConfigured() || records.length === 0) {
      return {
        ok: false,
        status: null,
        successful: 0,
        failed: records.length,
        detail: "export not configured",
        url: url ?? "",
      };
    }
    if (this.circuitOpen()) {
      return {
        ok: false,
        status: null,
        successful: 0,
        failed: records.length,
        detail: "export circuit open",
        url: url ?? "",
      };
    }
    if (!this.hasAuth()) {
      return {
        ok: false,
        status: null,
        successful: 0,
        failed: records.length,
        detail: "missing auth headers",
        url: url ?? "",
      };
    }

    try {
      const res = await fetch(url!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.otlpHeaders,
        },
        body: JSON.stringify(toOpenObserveRecords(records)),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await res.text().catch(() => "");
      const result = summarizeIngestResponse(res.status, body);
      result.url = url!;
      if (!result.ok) this.recordFailure(stream, result);
      else this.recordSuccess();
      return result;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "network error";
      const result: IngestResult = {
        ok: false,
        status: null,
        successful: 0,
        failed: records.length,
        detail,
        url: url!,
      };
      this.recordFailure(stream, result);
      return result;
    }
  }

  sendLogs(records: StructuredLog[]): void {
    this.enqueue("application_logs", records);
  }

  sendSecurity(records: SecurityEvent[]): void {
    this.enqueue("security_events", records);
  }

  sendClientEvents(records: ClientTelemetryEvent[]): void {
    this.enqueue("client_events", records);
  }
}
