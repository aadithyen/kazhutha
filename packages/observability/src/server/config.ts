export interface ObservabilityConfig {
  enabled: boolean;
  serviceName: string;
  environment: string;
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
  otlpEndpoint: string | null;
  otlpHeaders: Record<string, string>;
  ipHashSalt: string;
  openObserveOrg: string;
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    headers[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return headers;
}

export function loadObservabilityConfig(): ObservabilityConfig {
  const enabled = (process.env.TELEMETRY_ENABLED ?? "true").toLowerCase() !== "false";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "") ?? null;
  return {
    enabled,
    serviceName: process.env.OTEL_SERVICE_NAME ?? "kazhutha-signaling",
    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "0.1.0",
    logLevel: (process.env.LOG_LEVEL ?? "info") as ObservabilityConfig["logLevel"],
    otlpEndpoint: endpoint,
    otlpHeaders: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    ipHashSalt: process.env.TELEMETRY_IP_HASH_SALT ?? "kazhutha-dev-salt",
    openObserveOrg: process.env.OPENOBSERVE_ORG ?? "default",
  };
}
