/** Low-cardinality security event kinds for abuse detection. */
export type SecurityEventType =
  | "authentication_failure"
  | "rate_limit_exceeded"
  | "unauthorized_access"
  | "invalid_request"
  | "signaling_abuse"
  | "connection_flood";

export type TelemetryStream =
  | "application_logs"
  | "security_events"
  | "client_events"
  | "metrics";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface BaseTelemetryFields {
  timestamp: string;
  service: string;
  environment: string;
  version: string;
  trace_id?: string;
  session_id?: string;
  peer_id?: string;
  room_code?: string;
}

export interface StructuredLog extends BaseTelemetryFields {
  level: LogLevel;
  message: string;
  stream: "application_logs";
  route?: string;
  method?: string;
  status_code?: number;
  duration_ms?: number;
  error_name?: string;
  error_message?: string;
  security_event_type?: SecurityEventType;
  [key: string]: unknown;
}

export type ClientEventType =
  | "peer_connection_created"
  | "connection_established"
  | "connection_failed"
  | "connection_closed"
  | "ice_failed"
  | "ice_restart"
  | "peer_reconnected"
  | "signaling_connected"
  | "signaling_disconnected"
  | "signaling_reconnect"
  | "signaling_error"
  | "webrtc_stats_sample"
  | "game_created"
  | "player_joined"
  | "player_left"
  | "game_started"
  | "game_finished"
  | "game_abandoned"
  | "peer_connection_established"
  | "peer_connection_failed"
  | "frontend_error"
  | "webrtc_error";

export interface ClientTelemetryEvent extends BaseTelemetryFields {
  stream: "client_events";
  event_type: ClientEventType;
  browser?: string;
  os?: string;
  route?: string;
  candidate_type?: "host" | "srflx" | "relay" | "unknown";
  connection_state?: string;
  ice_connection_state?: string;
  rtt_ms?: number;
  packet_loss?: number;
  jitter_ms?: number;
  bytes_sent?: number;
  bytes_received?: number;
  reconnect_count?: number;
  connection_duration_ms?: number;
  player_count?: number;
  game_duration_ms?: number;
  disconnect_reason?: string;
  error_message?: string;
  error_stack?: string;
  security_event_type?: SecurityEventType;
  [key: string]: unknown;
}

export interface SecurityEvent extends BaseTelemetryFields {
  stream: "security_events";
  security_event_type: SecurityEventType;
  message: string;
  route?: string;
  source_hash?: string;
  detail?: string;
}

export interface TelemetryRecord {
  stream: TelemetryStream;
  body: StructuredLog | ClientTelemetryEvent | SecurityEvent | MetricPoint;
}

export interface MetricPoint {
  stream: "metrics";
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  attributes?: Record<string, string>;
}

export type TelemetryHandler = (record: TelemetryRecord) => void;
