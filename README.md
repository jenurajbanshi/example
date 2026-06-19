# Orbital Estates

Orbital Estates is a realtime multiplayer property-trading board game inspired by classic buy-and-rent board games, but played on a circular orbit instead of a square track.

Players do not create accounts. The Expo React Native client creates a random device ID, stores it locally with `expo-secure-store`, and uses that device ID to create or rejoin games.

## Demo

Try the live project demo at <https://orbital-estatesmobile-production.up.railway.app/>.

## Tech stack

- **Mobile/web client:** Expo + React Native + TypeScript
- **Realtime server:** Node.js 22 + TypeScript + Fastify + Socket.IO
- **Shared game rules:** TypeScript workspace package consumed by both client and server
- **Scale-out coordination:** Redis for Socket.IO pub/sub and room state storage when `REDIS_URL` is set
- **Security middleware:** Helmet, CORS configuration, rate limiting, and Zod payload validation
- **Deployment:** Railway configs for server + web, Dockerfile for the server, and Docker Compose with Redis

## Repository layout

```text
apps/
  mobile/   Expo React Native client
  server/   Fastify + Socket.IO authoritative realtime server
packages/
  shared/   Circular board, player, tile, turn, rent, and purchase rules
docs/
  architecture.md
  railway-deployment.md
```

## Local development

```bash
npm install
npm run build -w @orbital-estates/shared
npm run dev:server
npm run dev:mobile
```

The mobile app defaults to `http://localhost:3000`. On a physical device, enter the LAN URL for the server in the app's Server URL field.

## Railway deployment

This repo includes two Railway config files:

- `railway.server.toml` for the Fastify + Socket.IO server
- `railway.web.toml` for the Expo web client

Create two GitHub-backed Railway services from this repository, keep both root directories set to `/`, and point each service at its config file path. Add a Railway Redis service and set the server `REDIS_URL` to the Redis connection variable.

See [docs/railway-deployment.md](docs/railway-deployment.md) for the full step-by-step setup.

## Tests and checks

```bash
npm test
npm run typecheck
npm run build
```

## Run the server with Redis

```bash
docker compose up --build
```

When `REDIS_URL` is unset, the server uses an in-memory store suitable for local development. Set `REDIS_URL` in shared, staging, or production environments so multiple server instances can serve the same game rooms.
