# AGENTS.md

## Cursor Cloud specific instructions

Kazhutha is a pnpm + TypeScript monorepo for a P2P (WebRTC) card game. Node 20+ and pnpm are
required (the VM has both; the update script runs `pnpm install`).

Workspaces:
- `packages/shared`, `packages/game`, `packages/network` — libraries consumed via `workspace:*`
  source (no build step; `build`/`typecheck` are just `tsc --noEmit`).
- `apps/signaling` — WebSocket signaling/tracker server (`ws://localhost:8080`). Only relays room
  membership + SDP/ICE; never sees game state.
- `apps/web` — Vite + React SPA (`http://localhost:5173` in dev).

Standard commands (see root `package.json`): `pnpm typecheck`, `pnpm build`, `pnpm lint`
(lint is currently a no-op `echo skip` in every package — there is no ESLint config or test suite).

Running the app in dev requires BOTH services at once, in separate terminals:
- `pnpm dev:signaling` (must be up first; the web client connects to it over WebSocket)
- `pnpm dev:web`

Non-obvious gotchas:
- The web app reads `VITE_SIGNALING_URL` (defaults to `ws://localhost:8080`). If you change the
  signaling port/host, set this env/build arg or the browser can't reach the tracker.
- A game needs **at least 2 connected players who are all "ready"** before the host's "Start game"
  button enables. To test end-to-end, open two separate browser windows (use incognito/guest for the
  second so it gets its own `localStorage` identity) on the same `/room/<CODE>` URL. WebRTC works over
  loopback between two local tabs with the default ICE config — no TURN server needed locally.
- Star topology: the room creator is the authoritative host running the engine; other clients open a
  WebRTC DataChannel to the host and apply broadcast events through the same reducer.
