import { loadObservabilityConfig } from "./config.js";
import { StructuredLogger } from "./logger.js";
import { initMetrics, type MetricsBundle } from "./metrics.js";
import { SecurityTracker } from "./security.js";
import { OpenObserveIngest } from "./openobserve.js";
import type { SecurityEvent, StructuredLog } from "../types.js";

export interface ServerObservability {
  config: ReturnType<typeof loadObservabilityConfig>;
  logger: StructuredLogger;
  metrics: MetricsBundle | null;
  security: SecurityTracker;
  ingest: OpenObserveIngest;
  shutdown: () => Promise<void>;
}

export function createServerObservability(): ServerObservability {
  const config = loadObservabilityConfig();
  const ingest = new OpenObserveIngest(config);
  const logger = new StructuredLogger(config);
  const security = new SecurityTracker(config);
  const metrics = initMetrics(config);

  logger.addSink((entry: StructuredLog) => {
    process.stdout.write(JSON.stringify(entry) + "\n");
    ingest.sendLogs([entry]);
  });

  security.addSink((event: SecurityEvent) => {
    const line = JSON.stringify(event);
    process.stdout.write(line + "\n");
    ingest.sendSecurity([event]);
  });

  if (config.otlpEndpoint) {
    logger.info("OpenObserve export enabled", {
      route: "/startup",
      openobserve_endpoint: config.otlpEndpoint,
      openobserve_org: config.openObserveOrg,
      openobserve_auth_configured: ingest.hasAuth(),
    });
    void ingest.verifyIngest().then((result) => {
      logger.log(result.ok ? "info" : "warn", "OpenObserve startup ingest probe", {
        route: "/startup",
        ingest_ok: result.ok,
        ingest_status: result.status,
        ingest_successful: result.successful,
        ingest_failed: result.failed,
        ingest_detail: result.detail,
        ingest_url: result.url,
      });
    });
  } else {
    logger.info("OpenObserve export disabled (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)", {
      route: "/startup",
    });
  }

  return {
    config,
    logger,
    metrics,
    security,
    ingest,
    shutdown: async () => {
      await metrics?.shutdown();
    },
  };
}

export { loadObservabilityConfig } from "./config.js";
export type { MetricsBundle } from "./metrics.js";
export type { ClientTelemetryEvent, SecurityEvent, StructuredLog } from "../types.js";
