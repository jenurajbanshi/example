# Railway deployment

This repository can deploy to Railway as three services in one project:

1. **Redis** - managed Railway Redis database.
2. **Orbital Estates Server** - Fastify + Socket.IO realtime API.
3. **Orbital Estates Web** - Expo web export served as a static SPA.

Keep both app services pointed at the monorepo root (`/`) so npm workspaces and `packages/shared` are available during builds.

## 1. Create the Railway project

1. Create a new Railway project.
2. Add a GitHub repo service for the server.
3. Add a second GitHub repo service for the web client.
4. Keep both GitHub services pointed at the repo root (`/`), then set their config file paths:
   - Server: `/railway.server.toml`
   - Web: `/railway.web.toml`

## 2. Automated setup

After linking the repo to your Railway project with `railway login` and `railway link`, run:

```bash
npm run railway:bootstrap -- "Orbital Estates Server" "Orbital Estates Web"
```

The bootstrap script:

1. Adds a Railway Redis database unless `RAILWAY_SKIP_REDIS_CREATE=true` is set.
2. Wires the server Redis and production variables.
3. Generates Railway public domains for the server and web services.
4. Sets the web `EXPO_PUBLIC_SERVER_URL` to the server public domain.
5. Sets the server `CORS_ORIGIN` to the web public domain.
6. Redeploys the web and server services.

If Redis already exists, skip creation and only wire variables:

```bash
RAILWAY_SKIP_REDIS_CREATE=true npm run railway:bootstrap -- "Orbital Estates Server" "Orbital Estates Web"
```

If you use custom domains, skip Railway domain generation and pass the final URLs:

```bash
SERVER_PUBLIC_URL=https://api.example.com WEB_PUBLIC_URL=https://game.example.com RAILWAY_GENERATE_DOMAINS=false npm run railway:bootstrap -- "Orbital Estates Server" "Orbital Estates Web"
```

To sync only domain-related variables later:

```bash
npm run railway:sync:domains -- "Orbital Estates Server" "Orbital Estates Web"
```

To run only Redis setup:

```bash
npm run railway:setup:redis -- "Orbital Estates Server"
```

If the Redis service is not named `Redis`, pass its exact Railway service name through `RAILWAY_REDIS_SERVICE`:

```bash
RAILWAY_REDIS_SERVICE="Orbital Redis" RAILWAY_SKIP_REDIS_CREATE=true npm run railway:setup:redis -- "Orbital Estates Server"
```

## 3. Configure the server service manually

In the server service settings:

- **Root Directory:** `/`
- **Config File Path:** `/railway.server.toml`

Set variables:

```text
NODE_ENV=production
HOST=0.0.0.0
TRUST_PROXY=true
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_KEY_PREFIX=orbital-estates
GAME_TTL_SECONDS=86400
CORS_ORIGIN=*
```

Railway provides `PORT` automatically, so do not hard-code it.

Deploy the server and generate a public domain. Verify:

```text
https://<server-domain>/health
```

The response should report `"storage": "redis"` when `REDIS_URL` is set.

## 4. Configure the web service manually

In the web service settings:

- **Root Directory:** `/`
- **Config File Path:** `/railway.web.toml`

Set variables:

```text
EXPO_PUBLIC_SERVER_URL=https://<server-domain>
```

Deploy the web service and generate a public domain.

## 5. Lock down CORS manually

After the web domain exists, update the server variable:

```text
CORS_ORIGIN=https://<web-domain>
```

Redeploy the server.

For local testing or early smoke tests, `CORS_ORIGIN=*` is acceptable. Production should use the exact web origin.

## 6. Build commands used by Railway

Server service:

```bash
npm run build:server
npm run start:server
```

Web service:

```bash
npm run build:web
npm run start:web
```

The web build outputs to `apps/mobile/dist` and is served with `serve` in SPA mode on Railway's `$PORT`.

## 7. Smoke test

After deployment, run:

```bash
npm run railway:smoke -- https://<server-domain> https://<web-domain>
```

The smoke test verifies the server `/health` endpoint, confirms Redis-backed storage, and confirms the web app returns HTML.

1. Open the web Railway domain.
2. Confirm the Server URL field is prefilled with the deployed server URL.
3. Create a game.
4. Open the same web URL in a second browser or private window.
5. Join using the game code.
6. Start the game and roll dice.

If the web client cannot connect:

- Confirm `EXPO_PUBLIC_SERVER_URL` includes `https://`.
- Confirm the server has a public Railway domain.
- Confirm `CORS_ORIGIN` is either `*` or the exact web origin.
- Confirm the server health endpoint reports Redis storage.
