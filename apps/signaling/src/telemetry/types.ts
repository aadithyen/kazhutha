/** Low-cardinality security event kinds for abuse detection. */
export type SecurityEventType =
  | "authentication_failure"
  | "rate_limit_exceeded"
  | "unauthorized_access"
  | "invalid_request"
  | "signaling_abuse"
  | "connection_flood";

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

export interface SecurityEvent extends BaseTelemetryFields {
  stream: "security_events";
  security_event_type: SecurityEventType;
  message: string;
  route?: string;
  source_hash?: string;
  detail?: string;
}
