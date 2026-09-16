import type { TelemetryHandler, TelemetryRecord } from "./types.js";

let handler: TelemetryHandler | null = null;

/** Register a global telemetry sink (browser reporter or no-op). */
export function setTelemetryHandler(next: TelemetryHandler | null): void {
  handler = next;
}

/** Emit a telemetry record if a handler is registered. Never throws. */
export function emitTelemetry(record: TelemetryRecord): void {
  try {
    handler?.(record);
  } catch {
    // telemetry must never break the game
  }
}
