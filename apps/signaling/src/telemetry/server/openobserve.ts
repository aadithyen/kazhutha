import type { ClientTelemetryEvent, SecurityEvent, StructuredLog } from "../types.js";
import type { ObservabilityConfig } from "./config.js";

type IngestPayload = StructuredLog | SecurityEvent | ClientTelemetryEvent;

const EXPORT_ERROR_LOG_INTERVAL_MS = 60_000;

/** OpenObserve JSON ingest: {OTEL_EXPORTER_OTLP_ENDPOINT}/{stream}/_json */
export function openObserveIngestUrl(config: ObservabilityConfig, stream: string): string | null {
  if (!config.otlpEndpoint) return null;
  return `${config.otlpEndpoint}/${stream}/_json`;
}

/**
 * Forward JSON records to OpenObserve _json ingest endpoints.
 * Gameplay must not break if export fails; failures log a rate-limited warning.
 */
export class OpenObserveIngest {
  private lastErrorLogAt = 0;

  constructor(private readonly config: ObservabilityConfig) {}

  private logExportFailure(stream: string, status: number | null, detail: string): void {
    const now = Date.now();
    if (now - this.lastErrorLogAt < EXPORT_ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLogAt = now;
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        message: "OpenObserve export failed",
        stream,
        status_code: status,
        detail,
        service: this.config.serviceName,
      }),
    );
  }

  private async post(stream: string, records: IngestPayload[]): Promise<void> {
    const url = openObserveIngestUrl(this.config, stream);
    if (!url || records.length === 0) return;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.otlpHeaders,
        },
        body: JSON.stringify(records),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logExportFailure(stream, res.status, body.slice(0, 200) || res.statusText);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "network error";
      this.logExportFailure(stream, null, detail);
    }
  }

  sendLogs(records: StructuredLog[]): void {
    void this.post("application_logs", records);
  }

  sendSecurity(records: SecurityEvent[]): void {
    void this.post("security_events", records);
  }

  sendClientEvents(records: ClientTelemetryEvent[]): void {
    void this.post("client_events", records);
  }
}
