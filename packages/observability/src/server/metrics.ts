import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { metrics } from "@opentelemetry/api";
import type { ObservabilityConfig } from "./config.js";

export interface MetricsBundle {
  httpRequestsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  httpErrorsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  httpRequestDuration: ReturnType<ReturnType<typeof metrics.getMeter>["createHistogram"]>;
  activeConnections: ReturnType<ReturnType<typeof metrics.getMeter>["createUpDownCounter"]>;
  signalingConnectionsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  signalingErrorsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  signalingReconnectsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  signalingMessageErrorsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
  shutdown: () => Promise<void>;
}

export function initMetrics(config: ObservabilityConfig): MetricsBundle | null {
  if (!config.enabled) return null;

  const meterProvider = new MeterProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.version,
      "deployment.environment": config.environment,
    }),
  });

  if (config.otlpEndpoint) {
    const exporter = new OTLPMetricExporter({
      url: `${config.otlpEndpoint}/v1/metrics`,
      headers: config.otlpHeaders,
    });
    meterProvider.addMetricReader(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 30_000,
      }),
    );
  }

  metrics.setGlobalMeterProvider(meterProvider);
  const meter = metrics.getMeter("kazhutha-signaling");

  return {
    httpRequestsTotal: meter.createCounter("http_requests_total", {
      description: "Total HTTP requests",
    }),
    httpErrorsTotal: meter.createCounter("http_errors_total", {
      description: "HTTP responses with status >= 400",
    }),
    httpRequestDuration: meter.createHistogram("http_request_duration", {
      description: "HTTP request duration in milliseconds",
      unit: "ms",
    }),
    activeConnections: meter.createUpDownCounter("active_connections", {
      description: "Active WebSocket connections",
    }),
    signalingConnectionsTotal: meter.createCounter("signaling_connections_total", {
      description: "Signaling WebSocket connections opened",
    }),
    signalingErrorsTotal: meter.createCounter("signaling_errors_total", {
      description: "Signaling layer errors",
    }),
    signalingReconnectsTotal: meter.createCounter("signaling_reconnects_total", {
      description: "Signaling reconnects (same peerId)",
    }),
    signalingMessageErrorsTotal: meter.createCounter("signaling_message_errors_total", {
      description: "Invalid or malformed signaling messages",
    }),
    shutdown: () => meterProvider.shutdown(),
  };
}
