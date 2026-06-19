# Architecture

## Product shape

Orbital Estates is a multiplayer circular-board property game:

- Players orbit a 24-space circular board.
- Passing the launch tile grants salary.
- Property tiles can be purchased by the player who lands there.
- Other players pay rent when landing on owned property.
- Tax, bonus, and chance tiles create board-game variation.
- The server is authoritative for dice rolls, purchases, rent, bankruptcy, and turn order.

## Identity model

The app intentionally avoids accounts. On first launch, the mobile client creates a random UUID-based device identifier and stores it with Expo SecureStore. The identifier is sent with game commands and acts as the player's stable room identity.

This keeps onboarding simple, but device IDs are not authentication. For production, add:

- TLS everywhere.
- Server-side command rate limits per IP and per device ID.
- Optional signed device attestations for abuse-prone environments.
- A room-level reconnect policy so stale disconnected devices do not block games forever.

## Why this server stack

The selected server stack is **Node.js 22 + TypeScript + Fastify + Socket.IO + Redis**.

### Scalability

- Socket.IO supports websocket-first realtime play and fallback transports.
- The Redis adapter lets multiple server instances publish room events to each other.
- Game state can be stored in Redis with TTLs, so any instance can process the next command for a room.
- Fastify keeps HTTP endpoints lightweight for health checks, room inspection, and future matchmaking APIs.

### Security

- Zod validates every realtime command payload.
- The server rolls dice and owns the state machine, so clients cannot submit arbitrary board positions.
- Helmet, configurable CORS, and rate limiting are enabled on HTTP routes.
- The client stores only an opaque device ID, not account credentials.

### Ease of deployment

- The server runs as a single Node container.
- Redis can be attached as a managed service on Fly.io, Render, Railway, AWS, GCP, or Azure.
- Expo keeps iOS and Android development unified and works well with EAS Build.

## Runtime modes

### Local development

Without `REDIS_URL`, the server uses an in-memory room store. This is useful for fast local iteration, but each server process has isolated game state.

### Shared and production environments

Set `REDIS_URL` to enable:

- Socket.IO cross-instance room broadcasts.
- Redis-backed game state storage.
- Game room TTL cleanup.

For production data retention, add PostgreSQL for durable user-independent game history, analytics, purchases, or moderation records. The live room state should still remain in Redis because board turns require low-latency reads and writes.

## Future work

- Add matchmaking and private-room invitation links.
- Add automatic turn timers and host controls for disconnected players.
- Add richer property sets, upgrades, auctions, and trading.
- Add server-side metrics for rooms, turn latency, command errors, and websocket connection counts.
- Add integration tests for the Socket.IO protocol.
