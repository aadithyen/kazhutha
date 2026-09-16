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
| `OPENOBSERVE_USER` | _(unset)_ | Alternative to headers: ingest user/email |
| `OPENOBSERVE_PASSWORD` | _(unset)_ | Ingest password or API token (used with `OPENOBSERVE_USER`) |
| `OPENOBSERVE_ORG` | `default` | Org label in telemetry (ingest URL uses org in `OTEL_EXPORTER_OTLP_ENDPOINT`) |
| `TELEMETRY_IP_HASH_SALT` | dev salt | Salt for hashed `source_hash` in security events |

When `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, logs still go to stdout as JSON; nothing is forwarded remotely. Export failures are rate-limited warnings on stderr (gameplay unaffected).

On startup, signaling logs `OpenObserve export enabled` (with `openobserve_auth_configured`) then an `OpenObserve startup ingest probe` line with `ingest_ok`, `ingest_status`, and `ingest_detail`. If `openobserve_auth_configured` is false, set `OPENOBSERVE_USER` + `OPENOBSERVE_PASSWORD` or `OTEL_EXPORTER_OTLP_HEADERS`.

In OpenObserve UI, open stream **`application_logs`** (not the default/metrics stream) and search for `kazhutha_openobserve_startup_probe` after deploy.

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

### Metrics (low cardinality, alert-ready)

**Operational gauges** (current state — use for capacity / “is anyone playing?” alerts):

| Metric | Meaning |
|--------|---------|
| `signaling_active_rooms` | Rooms with ≥1 connected player |
| `signaling_active_players` | Players connected across all rooms |
| `signaling_websocket_connections` | Open WebSocket connections |

**HTTP / availability** (error rate + latency):

| Metric | Meaning |
|--------|---------|
| `http_requests_total` | All HTTP requests |
| `http_errors_total` | Responses with status ≥ 400 |
| `http_server_errors_total` | **5xx only** — primary availability signal |
| `http_request_duration_ms` | Request latency histogram (ms) |

Labels: `method`, `route`, `status_code`, `status_class` (`2xx`/`3xx`/`4xx`/`5xx`).

**Signaling lifecycle**:

| Metric | Meaning |
|--------|---------|
| `signaling_connections_total` | WebSockets opened (cumulative) |
| `signaling_players_joined_total` | New players joined (excludes reconnect) |
| `signaling_players_left_total` | Players left |
| `signaling_rooms_created_total` | New room codes created |
| `signaling_reconnects_total` | Same `peerId` rejoined |
| `signaling_connection_duration_ms` | WebSocket session length histogram |
| `signaling_errors_total` | Socket / rate-limit errors (`reason` label) |
| `signaling_message_errors_total` | Bad messages (`reason` label) |
| `active_connections` | Legacy up/down counter (prefer `signaling_websocket_connections`) |

**Dependencies & client ingest**:

| Metric | Meaning |
|--------|---------|
| `turn_credential_errors_total` | Cloudflare TURN API failures |
| `telemetry_ingest_requests_total` | `POST /telemetry` requests |
| `telemetry_ingest_errors_total` | Failed ingest (4xx/5xx) |
| `telemetry_events_ingested_total` | Client events accepted |

Labels never include user/peer/session/IP — only `method`, `route`, `status_code`, `status_class`, `reason`, `reconnect`.

## OpenObserve setup

1. Run OpenObserve (or use hosted).
2. Create an ingest user/API key.
3. Set on signaling container:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=https://your-o2.example.com/api/default
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(email:password)>
   ```
4. Deploy signaling + web as usual.

## Dashboard

**Fastest path:** import the prebuilt dashboard JSON and follow the setup guide:

- [`docs/openobserve-dashboard-setup.md`](./openobserve-dashboard-setup.md) — import steps, empty-panel fixes, alert templates
- [`docs/dashboards/kazhutha-overview.dashboard.json`](./dashboards/kazhutha-overview.dashboard.json) — **Kazhutha Overview** (3 tabs: Overview, P2P & Games, Security)

Manual panel reference (if you prefer to build from scratch):

### Application

- Request rate: `SELECT histogram(_timestamp) FROM application_logs WHERE route IS NOT NULL`
- Error rate: logs where `level='error'` or `status_code >= 500`
- 4xx/5xx: `status_code` breakdown
- Latency: `avg(duration_ms)` by `route`
- Active rooms / players: `signaling_active_rooms`, `signaling_active_players`
- WebSocket connections: `signaling_websocket_connections`
- HTTP latency p95: `http_request_duration_ms` by `route`
- Error rate: `http_server_errors_total` / `http_requests_total` where `status_class='5xx'`

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

## Alerts (OTLP metrics + logs)

Tune to your traffic. For low-volume hobby use, start in **alert-only / high threshold** or monitor dashboards first.

OpenObserve (or any OTLP backend) can alert on exported metrics directly. Example conditions:

| Alert | Metric / query idea | Suggested threshold |
|-------|---------------------|---------------------|
| **Signaling down** | `http_requests_total{route="/health"}` rate = 0 for 5 min | Zero health checks |
| **High 5xx rate** | `rate(http_server_errors_total[5m])` | > 0.1/s or any sustained 5xx |
| **HTTP error ratio** | `http_errors_total` / `http_requests_total` over 5 min | > 5% |
| **Slow ICE endpoint** | p95 `http_request_duration_ms{route="/health"}` | > 2000 ms |
| **TURN broken** | `rate(turn_credential_errors_total[5m])` | > 0 |
| **Telemetry ingest failing** | `rate(telemetry_ingest_errors_total[5m])` | > 0 |
| **Signaling errors** | `rate(signaling_errors_total[5m])` | > 1/s sustained |
| **Connection flood** | `signaling_websocket_connections` | > N (your capacity) |
| **No players (optional)** | `signaling_active_players` = 0 for 24 h | Informational only |

**Log-based alerts** (streams above) still useful for client-side P2P and security:

| Alert | Condition | Notes |
|-------|-----------|-------|
| P2P failure spike | `connection_failed` > 10 in 15 min (`client_events`) | NAT/TURN issues |
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
