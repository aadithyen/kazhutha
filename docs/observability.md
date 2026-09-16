# Observability

Lightweight OpenTelemetry + OpenObserve integration for debugging Kazhutha sessions, P2P connectivity, and basic abuse patterns.

## Architecture

| Source | What ships | Destination |
|--------|------------|-------------|
| Signaling server (`apps/signaling/src/telemetry`) | Structured JSON logs, OTLP metrics, security events | OpenObserve (`application_logs`, `security_events`, OTLP metrics) |
| Browser client | Batched game/WebRTC/error events | `POST /telemetry` on signaling → OpenObserve `client_events` stream |

Correlation: every browser session gets a `trace_id`; `room_code` is the session/game ID. Search OpenObserve for `room_code:"ABC123"` to see server joins, security events, WebRTC samples, and game lifecycle events for one room.

Telemetry is **best-effort**. If OpenObserve is down, the game keeps working.

## Environment variables

### Signaling server

| Variable | Default | Purpose |
|----------|---------|---------|
| `TELEMETRY_ENABLED` | `true` | Master switch |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `ENVIRONMENT` | `development` | Deployment label |
| `APP_VERSION` | `0.1.0` | App version on all records |
| `OTEL_SERVICE_NAME` | `kazhutha-signaling` | Service name |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(unset)_ | OpenObserve base URL, e.g. `http://localhost:5080/api/default` |
| `OTEL_EXPORTER_OTLP_HEADERS` | _(unset)_ | Comma-separated headers, e.g. `Authorization=Basic <base64>` |
| `OPENOBSERVE_ORG` | `default` | Org label in telemetry (ingest URL uses org in `OTEL_EXPORTER_OTLP_ENDPOINT`) |
| `TELEMETRY_IP_HASH_SALT` | dev salt | Salt for hashed `source_hash` in security events |

When `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, logs still go to stdout as JSON; nothing is forwarded remotely. Export failures are rate-limited warnings on stderr (gameplay unaffected).

On startup, signaling logs either `OpenObserve export enabled` or `OpenObserve export disabled` so you can tell which mode is active.

### Web client (build-time)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_TELEMETRY_ENABLED` | `true` | Disable client telemetry |
| `VITE_APP_VERSION` | `0.1.0` | Version label on client events |

Client events POST to `{signaling-http-base}/telemetry` (derived from `VITE_SIGNALING_URL`).

## OpenObserve streams

Create these streams (or let first ingest create them):

- `application_logs` — server lifecycle, HTTP, signaling joins/leaves
- `security_events` — rate limits, invalid messages, origin rejects, floods
- `client_events` — WebRTC, game lifecycle, frontend errors
- OTLP metrics stream (default metrics table) — counters/histograms from signaling

## What is collected

### Server logs (no secrets)

- HTTP method, route, status, duration
- Signaling connect/disconnect, join/leave, reconnects
- TURN credential failures
- Trace/session/peer IDs

**Never logged:** passwords, tokens, cookies, full SDP/ICE payloads, raw IPs (hashed `source_hash` only for security events).

### Client events

- WebRTC: connection state, ICE state, candidate type (host/srflx/relay), RTT, packet loss, jitter, bytes (sampled every ~8s while connected)
- Signaling: connect, disconnect, reconnect, errors
- Game: created, player join/leave, started, finished, abandoned
- Errors: `window.onerror`, unhandled rejections (message + stack)

**Never sent:** SDP bodies, ICE candidates, tokens, full game state/hands.

### Metrics (low cardinality)

- `http_requests_total`, `http_request_duration`, `http_errors_total`
- `active_connections`, `signaling_connections_total`, `signaling_errors_total`
- `signaling_reconnects_total`, `signaling_message_errors_total`

Labels: `method`, `route`, `status_code`, `reason` — **not** user/peer/session/IP.

## OpenObserve setup

1. Run OpenObserve (or use hosted).
2. Create an ingest user/API key.
3. Set on signaling container:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=https://your-o2.example.com/api/default
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(email:password)>
   ```
4. Deploy signaling + web as usual.

## Dashboard (suggested panels)

Import manually in OpenObserve UI — one dashboard **Kazhutha Overview**:

### Application

- Request rate: `SELECT histogram(_timestamp) FROM application_logs WHERE route IS NOT NULL`
- Error rate: logs where `level='error'` or `status_code >= 500`
- 4xx/5xx: `status_code` breakdown
- Latency: `avg(duration_ms)` by `route`
- Active connections: OTLP metric `active_connections`

### P2P (`client_events`)

- Connection success vs failure: `event_type` in (`connection_established`, `connection_failed`, `peer_connection_failed`)
- Establishment time: `establishment_duration_ms` avg
- Direct vs TURN: `candidate_type` counts (`host`/`srflx` vs `relay`)
- RTT / packet loss: from `webrtc_stats_sample`
- Reconnects: `signaling_reconnect`, `peer_reconnected`

### Security (`security_events`)

- Count by `security_event_type`
- Rate-limit / flood spikes over time

### Errors

- `frontend_error`, `webrtc_error`, server `level=error`, `signaling_errors_total`

## Alerts (suggested thresholds)

Tune to your traffic. For low-volume hobby use, start in **alert-only / high threshold** or monitor dashboards first.

| Alert | Condition | Notes |
|-------|-----------|-------|
| High 5xx rate | >5 server errors in 5 min | Backend health |
| High latency | `duration_ms` p95 > 2000 on `/ice-servers` | TURN API slowness |
| Request spike | `http_requests_total` 3× baseline over 10 min | Possible abuse |
| P2P failure spike | `connection_failed` > 10 in 15 min | NAT/TURN issues |
| TURN surge | `candidate_type=relay` > 50% of samples in 1 h | Relay fallback |
| Auth/origin rejects | `unauthorized_access` > 20 in 10 min | Misconfigured origins or probing |
| Rate limits | `rate_limit_exceeded` > 30 in 10 min | Hammering |

If traffic is too low for static alerts, use dashboard checks weekly instead.

## Privacy

See [telemetry-privacy.md](./telemetry-privacy.md) for the client data policy.

## Tests

```bash
pnpm --filter @kazhutha/observability test
pnpm typecheck
```
