import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { metrics } from "@opentelemetry/api";
import type { ObservabilityConfig } from "./config.js";

export interface OperationalSnapshot {
  activeRooms: number;
  activePlayers: number;
  websocketConnections: number;
}

type Counter = ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>;
type Histogram = ReturnType<ReturnType<typeof metrics.getMeter>["createHistogram"]>;
type UpDownCounter = ReturnType<ReturnType<typeof metrics.getMeter>["createUpDownCounter"]>;

export interface MetricsBundle {
  httpRequestsTotal: Counter;
  httpErrorsTotal: Counter;
  httpServerErrorsTotal: Counter;
  httpRequestDurationMs: Histogram;
  activeConnections: UpDownCounter;
  signalingConnectionsTotal: Counter;
  signalingErrorsTotal: Counter;
  signalingReconnectsTotal: Counter;
  signalingMessageErrorsTotal: Counter;
  signalingPlayersJoinedTotal: Counter;
  signalingPlayersLeftTotal: Counter;
  signalingRoomsCreatedTotal: Counter;
  signalingConnectionDurationMs: Histogram;
  turnCredentialErrorsTotal: Counter;
  telemetryIngestRequestsTotal: Counter;
  telemetryIngestErrorsTotal: Counter;
  telemetryEventsIngestedTotal: Counter;
  registerOperationalGauges: (snapshot: () => OperationalSnapshot) => void;
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

  const activeRoomsGauge = meter.createObservableGauge("signaling_active_rooms", {
    description: "Rooms with at least one connected player",
  });
  const activePlayersGauge = meter.createObservableGauge("signaling_active_players", {
    description: "Players currently connected across all rooms",
  });
  const websocketConnectionsGauge = meter.createObservableGauge("signaling_websocket_connections", {
    description: "Open WebSocket connections to the signaling server",
  });

  let readSnapshot: (() => OperationalSnapshot) | null = null;

  const observeOperational = (result: { observe: (value: number) => void }, value: number) => {
    result.observe(Math.max(0, value));
  };

  activeRoomsGauge.addCallback((result) => {
    if (!readSnapshot) return;
    observeOperational(result, readSnapshot().activeRooms);
  });
  activePlayersGauge.addCallback((result) => {
    if (!readSnapshot) return;
    observeOperational(result, readSnapshot().activePlayers);
  });
  websocketConnectionsGauge.addCallback((result) => {
    if (!readSnapshot) return;
    observeOperational(result, readSnapshot().websocketConnections);
  });

  return {
    httpRequestsTotal: meter.createCounter("http_requests_total", {
      description: "Total HTTP requests",
    }),
    httpErrorsTotal: meter.createCounter("http_errors_total", {
      description: "HTTP responses with status >= 400",
    }),
    httpServerErrorsTotal: meter.createCounter("http_server_errors_total", {
      description: "HTTP 5xx responses (use for availability alerts)",
    }),
    httpRequestDurationMs: meter.createHistogram("http_request_duration_ms", {
      description: "HTTP request duration in milliseconds",
      unit: "ms",
      advice: {
        explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      },
    }),
    activeConnections: meter.createUpDownCounter("active_connections", {
      description: "Active WebSocket connections (legacy; prefer signaling_websocket_connections gauge)",
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
    signalingPlayersJoinedTotal: meter.createCounter("signaling_players_joined_total", {
      description: "Players who joined a room (excludes reconnects)",
    }),
    signalingPlayersLeftTotal: meter.createCounter("signaling_players_left_total", {
      description: "Players who left a room",
    }),
    signalingRoomsCreatedTotal: meter.createCounter("signaling_rooms_created_total", {
      description: "Rooms created (first player in a new room code)",
    }),
    signalingConnectionDurationMs: meter.createHistogram("signaling_connection_duration_ms", {
      description: "WebSocket connection lifetime in milliseconds",
      unit: "ms",
      advice: {
        explicitBucketBoundaries: [
          1000, 5000, 15_000, 30_000, 60_000, 300_000, 900_000, 1_800_000, 3_600_000,
        ],
      },
    }),
    turnCredentialErrorsTotal: meter.createCounter("turn_credential_errors_total", {
      description: "Cloudflare TURN credential generation failures",
    }),
    telemetryIngestRequestsTotal: meter.createCounter("telemetry_ingest_requests_total", {
      description: "Client telemetry POST /telemetry requests",
    }),
    telemetryIngestErrorsTotal: meter.createCounter("telemetry_ingest_errors_total", {
      description: "Failed client telemetry ingest requests (4xx/5xx)",
    }),
    telemetryEventsIngestedTotal: meter.createCounter("telemetry_events_ingested_total", {
      description: "Client telemetry events accepted for forwarding",
    }),
    registerOperationalGauges: (snapshot) => {
      readSnapshot = snapshot;
    },
    shutdown: () => meterProvider.shutdown(),
  };
}
