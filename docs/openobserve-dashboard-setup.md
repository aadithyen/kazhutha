# OpenObserve dashboard setup (Kazhutha)

Quick path: **import prebuilt dashboard**, verify streams, fix any empty metric panels.

## 1. Confirm data is flowing

In OpenObserve, open **Logs → Streams** and check these exist with recent rows:

| Stream | What you should see |
|--------|---------------------|
| `application_logs` | `HTTP request`, `Player joined room`, `Signaling connection opened` |
| `client_events` | `webrtc_stats_sample`, `connection_established`, `game_started` |
| `security_events` | (may be empty until abuse/errors) |
| **Metrics** (sidebar → Metrics) | `signaling_active_players`, `http_requests_total`, etc. |

Smoke-test query on logs:

```sql
SELECT * FROM "application_logs" ORDER BY _timestamp DESC LIMIT 20
```

Smoke-test on metrics (Metrics → Editor):

```promql
signaling_active_players
```

## 2. Import the dashboard

1. OpenObserve UI → **Dashboards** → **Import**
2. Upload [`dashboards/kazhutha-overview.dashboard.json`](./dashboards/kazhutha-overview.dashboard.json) (schema **v8** — required by OpenObserve 0.14+)
3. Pick folder → **Import**
4. Open **Kazhutha Overview**, set time range **Last 1 hour**, refresh

Three tabs:

- **Overview** — players/rooms/WebSockets (OTLP gauges), HTTP rate/errors/latency, joins
- **P2P & Games** — WebRTC RTT, packet loss, TURN candidate mix, game lifecycle
- **Security** — rate limits, origin rejects, frontend errors

## 3. Schema version

The import file is **dashboard schema v8** (192-column grid, v8 field bindings). Older v5 exports are kept as `dashboards/kazhutha-overview.v5.dashboard.json`; regenerate v8 with:

```bash
node docs/dashboards/convert-dashboard-v5-to-v8.mjs
```

## 4. If a panel is empty

### Log panels (SQL)

Panel editor → check **stream** matches your org (`application_logs`, `client_events`, `security_events`).

Run the panel SQL in **Logs → SQL** first. Common fixes:

- No traffic yet → play a test game (2 browser tabs, same room)
- Wrong stream name → rename stream in panel to match your ingest
- Field missing → expand one log row in UI, confirm field names (`message`, `event_type`, `duration_ms`)

### Metric panels (PromQL)

1. **Metrics → Explorer** — find exact metric names OpenObserve stored from OTLP
2. Panel editor → set **stream type** = `metrics`, paste working PromQL from Explorer
3. Gauges export every **30s** — wait one export cycle after joining a room

If OTLP metric names differ (rare), try prefix variants in Explorer search: `http_requests`, `signaling_active`.

Replace panel query examples:

| Panel | PromQL |
|-------|--------|
| Active players | `signaling_active_players` |
| HTTP req rate | `sum(rate(http_requests_total[5m]))` |
| HTTP 5xx rate | `sum(rate(http_server_errors_total[5m]))` |
| TURN errors | `sum(increase(turn_credential_errors_total[1h]))` |
| Signaling errors | `sum(rate(signaling_errors_total[5m]))` by `reason` |

## 5. Add panels manually (template)

**Dashboards → New Dashboard → Add panel**

### Stat: current players (gauge, metrics)

- Type: **Gauge**
- Query type: **PromQL**
- Query: `signaling_active_players`

### HTTP latency by route (table, logs)

- Type: **Table**
- Stream: `application_logs`
- SQL:

```sql
SELECT route, avg(duration_ms) AS avg_ms, max(duration_ms) AS max_ms, count(*) AS requests
FROM "application_logs"
WHERE message = 'HTTP request'
GROUP BY route
ORDER BY avg_ms DESC
```

### WebRTC RTT (line, logs)

```sql
SELECT histogram(_timestamp) AS x_axis_1, avg(rtt_ms) AS y_axis_1
FROM "client_events"
WHERE event_type = 'webrtc_stats_sample' AND rtt_ms IS NOT NULL
GROUP BY x_axis_1
ORDER BY x_axis_1
```

Bind axes: X alias `x_axis_1`, Y alias `y_axis_1`.

### Room session drill-down (logs)

Search one game in **Logs**:

```sql
SELECT _timestamp, message, room_code, peer_id, player_count, duration_ms, status_code
FROM "application_logs"
WHERE room_code = 'YOUR_ROOM_CODE'
ORDER BY _timestamp ASC
```

Same for client timeline:

```sql
SELECT _timestamp, event_type, candidate_type, rtt_ms, packet_loss, error_message
FROM "client_events"
WHERE room_code = 'YOUR_ROOM_CODE'
ORDER BY _timestamp ASC
```

## 6. Suggested alerts (after dashboard looks good)

Create under **Alerts** using same queries:

| Alert | Query | Threshold |
|-------|-------|-----------|
| Signaling down | `sum(rate(http_requests_total{route="/health"}[5m]))` | = 0 for 5 min |
| 5xx spike | `sum(rate(http_server_errors_total[5m]))` | > 0 sustained |
| TURN broken | `sum(increase(turn_credential_errors_total[15m]))` | > 0 |
| P2P failures | SQL count on `client_events` where `event_type` in failures | > 10 / 15 min |
| Rate limit storm | SQL count on `security_events` where `rate_limit_exceeded` | > 30 / 10 min |

See [observability.md](./observability.md) for full metric catalog.

## 7. Generate traffic for a demo

1. Run signaling + web locally
2. Open room in two tabs (incognito for second player)
3. Both **Ready** → host **Start game**
4. Wait ~30s for OTLP gauge export
5. Refresh dashboard — players/rooms gauges should move, P2P tab should show RTT samples
