# Orbital Estates

Realtime multiplayer circular-board property game. npm workspaces monorepo:

- `apps/server` — Fastify + Socket.IO authoritative realtime server (Node 22, TypeScript, ESM).
- `apps/mobile` — Expo + React Native client (also runs as a web app).
- `packages/shared` — shared game rules consumed by both.

## Cursor Cloud specific instructions

The update script already runs `npm install` and builds `packages/shared`, so dependencies are ready when a session starts.

### Services and how to run them (dev mode)

| Service | Command | Port | Notes |
| --- | --- | --- | --- |
| Realtime server | `npm run dev:server` | 3000 | `tsx` watch via the `development` export condition; serves `GET /health` and `GET /games/:gameId`. |
| Web client | `npm run web -w @orbital-estates/mobile` | 8081 | Expo web (Metro). Prefix with `CI=1` to skip the interactive terminal UI. |
| Mobile (Expo dev) | `npm run dev:mobile` | 8081 | Expo dev server for native devices; web is usually the easiest to test in the VM. |

- The server uses an in-memory room store when `REDIS_URL` is unset (normal for local dev; no Redis needed). Set `REDIS_URL` only to test cross-instance scale-out.
- The first request to `http://localhost:8081` triggers Metro bundling and can take 10-30s; subsequent loads are fast.

### Checks (no lint script exists)

- `npm test` — Vitest unit tests for `packages/shared`.
- `npm run typecheck` — typechecks all workspaces.
- `npm run build` — builds `shared` then `server`.
- `npm run build -w @orbital-estates/shared` must have run before `typecheck`/`build` resolve `@orbital-estates/shared` types from `dist`. Dev (`dev:server`/`dev:mobile`) instead reads shared source directly via package `exports` conditions, so it works without the build.

### Testing full gameplay (non-obvious)

Starting a game requires **2+ players** and only the **host** (the device that created the game) can start it. A browser stores one device ID in `localStorage`, so a single browser is a single player. To test start/roll end-to-end, create the game in the UI, then join a second player with a small Socket.IO client against `http://localhost:3000` using the displayed game code (`joinGame` event with `{ gameId, deviceId, displayName }`), then click Start game / Roll dice in the UI.
