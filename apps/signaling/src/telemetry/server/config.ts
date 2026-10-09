export interface ObservabilityConfig {
  enabled: boolean;
  serviceName: string;
  environment: string;
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
  ipHashSalt: string;
}

export function loadObservabilityConfig(): ObservabilityConfig {
  const enabled = (process.env.TELEMETRY_ENABLED ?? "true").toLowerCase() !== "false";
  return {
    enabled,
    serviceName: process.env.OTEL_SERVICE_NAME ?? "kazhutha-signaling",
    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "0.1.0",
    logLevel: (process.env.LOG_LEVEL ?? "info") as ObservabilityConfig["logLevel"],
    ipHashSalt: process.env.TELEMETRY_IP_HASH_SALT ?? "kazhutha-dev-salt",
  };
}
