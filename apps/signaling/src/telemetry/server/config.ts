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

function loadAuthHeaders(): Record<string, string> {
  const explicit = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  if (Object.keys(explicit).length > 0) return explicit;

  const user = process.env.OPENOBSERVE_USER?.trim();
  const password = (process.env.OPENOBSERVE_PASSWORD ?? process.env.OPENOBSERVE_TOKEN)?.trim();
  if (user && password) {
    const token = Buffer.from(`${user}:${password}`, "utf8").toString("base64");
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

export function loadObservabilityConfig(): ObservabilityConfig {
  const enabled = (process.env.TELEMETRY_ENABLED ?? "true").toLowerCase() !== "false";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "") ?? null;
  const authHeaders = loadAuthHeaders();
  return {
    enabled,
    serviceName: process.env.OTEL_SERVICE_NAME ?? "kazhutha-signaling",
    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "0.1.0",
    logLevel: (process.env.LOG_LEVEL ?? "info") as ObservabilityConfig["logLevel"],
    otlpEndpoint: endpoint,
    otlpHeaders: authHeaders,
    ipHashSalt: process.env.TELEMETRY_IP_HASH_SALT ?? "kazhutha-dev-salt",
    openObserveOrg: process.env.OPENOBSERVE_ORG ?? "default",
  };
}
