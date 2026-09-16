# Client telemetry privacy

Kazhutha sends **diagnostic metadata** to help debug connectivity and sessions. It is not analytics for advertising.

## Sent from the browser

- Anonymous `peer_id` (random ID in `localStorage`)
- Room code (`session_id` / `room_code`)
- Trace ID (per tab session)
- Browser family and OS (derived from user agent)
- Current route path (e.g. `/room/ABC`)
- WebRTC connection health samples (RTT, loss, candidate type — not IPs)
- Game lifecycle events (start, finish, join, leave)
- Error messages and stack traces for uncaught errors

## Not sent

- Passwords, tokens, cookies, API keys
- Full SDP or ICE candidate strings
- Card hands or full game state
- Display names are not included in telemetry payloads by default
- Raw IP addresses (server hashes sources for security events only)

## Controls

- Set `VITE_TELEMETRY_ENABLED=false` at build time to disable browser export.
- Set `TELEMETRY_ENABLED=false` on signaling to disable server export.
- WebRTC stats sampling pauses when the tab is hidden (except errors).

## Retention

Configure retention in your OpenObserve organization. Delete streams or shorten retention if you do not need historical data.
