# Kazhutha | കഴുത

Kazhutha is a card game played in Kerala (similar rules might exist elsewhere). It is not a game with
one winner but one loser who's crowned the title of "Kazhutha" (കഴുത) meaning donkey. The game is usually
played in multiple times and everytime one lose a game the loser gains a piece of jewellery like a
machinga earring or plaavila crown :) .

## License

See LICENSE file.

## AI Use

This entire project code will be entirely AI generated. I just wanted this as a lightweight way to play
Kazhutha with my friends away without downloading any app (or asking them to download an app) with ads
or micro-transactions.

## Status

Stage 1 (MVP): playable end-to-end with a deliberately minimal UI. Rules engine, room/lobby flow,
P2P networking and reconnection are all functional. UI aesthetics, animations, sound and full PWA/a11y
polish are planned for later stages — see `requirements.md`.

## Architecture

- `packages/shared` — cards, deck, shuffle, ids, shared types.
- `packages/game` — pure deterministic game engine: events, reducer, validators, host-authoritative rules.
- `packages/network` — signalling client, WebRTC transport, `RoomClient` that wires network to the engine.
- `apps/signaling` — tiny Node/WebSocket tracker. Only relays room membership and SDP/ICE; it never sees
  game state.
- `apps/web` — Vite + React single-page app, fully client-side rendered (no server-side rendering, no
  Node runtime needed at request time — the production image is static files served by nginx).

Networking is a **star topology** for stage 1: every browser opens one WebRTC DataChannel directly to the
room host, who runs the authoritative engine and broadcasts events; everyone (including the host) applies
the same events through the identical reducer. The signalling server is only used for discovery and to
relay SDP/ICE — no gameplay ever passes through it. This is a deliberate MVP simplification of the
preferred full-mesh architecture in `requirements.md`; the `Transport`-style boundary in `packages/network`
keeps a later move to full mesh (or a server-authoritative fallback) a networking-layer change only.

## Development

Requires Node 20+ and pnpm.

```bash
pnpm install

# terminal 1 — signalling server (ws://localhost:8080)
pnpm dev:signaling

# terminal 2 — web app (http://localhost:5173)
pnpm dev:web
```

Open the app in two browser tabs/devices to play. `pnpm typecheck` and `pnpm build` run across every
workspace package.

## Running with Docker

```bash
docker compose up --build
```

This builds and runs the signalling server (`:8080`) and the web app (`:3000`, static nginx). Override
the `VITE_SIGNALING_URL` build arg in `docker-compose.yml` for LAN/internet deployments where the
signalling server isn't reachable at `localhost:8080` from players' browsers.

For strict NATs, set `TURN_API_TOKEN` / `TURN_KEY_ID` (a [Cloudflare Calls TURN key](https://developers.cloudflare.com/calls/turn/))
on the signalling server. It generates short-lived ICE credentials at `GET /ice-servers`, which browsers
fetch on room join — the API token and TURN credentials are never baked into the frontend bundle.

Each app also has a standalone `Dockerfile` if you want to build/deploy them independently:

```bash
docker build -f apps/web/Dockerfile -t kazhutha-web .
docker build -t kazhutha-signaling apps/signaling
```
