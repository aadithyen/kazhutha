import { BrowserTelemetryReporter, type BrowserTelemetryConfig } from "@kazhutha/observability/browser";
import { getSignalingUrl } from "./network";

let reporter: BrowserTelemetryReporter | null = null;

function loadBrowserTelemetryConfig(): BrowserTelemetryConfig {
  const signaling = import.meta.env.VITE_SIGNALING_URL || getSignalingUrl();
  const httpBase = signaling.replace(/^ws/, "http").replace(/\/$/, "");
  return {
    enabled: (import.meta.env.VITE_TELEMETRY_ENABLED ?? "true").toLowerCase() !== "false",
    endpoint: `${httpBase}/telemetry`,
    service: "kazhutha-web",
    environment: import.meta.env.MODE ?? "development",
    version: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
    flushIntervalMs: 10_000,
    maxBatchSize: 25,
  };
}

export function initTelemetry(): BrowserTelemetryReporter {
  if (reporter) return reporter;
  reporter = new BrowserTelemetryReporter(loadBrowserTelemetryConfig());
  reporter.init();
  return reporter;
}

export function getTelemetry(): BrowserTelemetryReporter | null {
  return reporter;
}
