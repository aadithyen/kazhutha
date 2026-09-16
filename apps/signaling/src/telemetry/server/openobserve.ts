import type { ClientTelemetryEvent, SecurityEvent, StructuredLog } from "../types.js";
import type { ObservabilityConfig } from "./config.js";

type IngestPayload = StructuredLog | SecurityEvent | ClientTelemetryEvent;

/**
 * Forward JSON records to OpenObserve _json ingest endpoints.
 * Fails silently so telemetry outages never affect gameplay.
 */
export class OpenObserveIngest {
  constructor(private readonly config: ObservabilityConfig) {}

  private async post(stream: string, records: IngestPayload[]): Promise<void> {
    if (!this.config.otlpEndpoint || records.length === 0) return;
    const url = `${this.config.otlpEndpoint}/api/${this.config.openObserveOrg}/${stream}/_json`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.otlpHeaders,
        },
        body: JSON.stringify(records),
      });
    } catch {
      // telemetry must be best-effort
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
