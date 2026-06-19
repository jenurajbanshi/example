# Railway deployment

This repository can deploy to Railway as three services in one project:

1. **Redis** - managed Railway Redis database.
2. **Orbital Estates Server** - Fastify + Socket.IO realtime API.
3. **Orbital Estates Web** - Expo web export served as a static SPA.

Keep both app services pointed at the monorepo root (`/`) so npm workspaces and `packages/shared` are available during builds.

## 1. Create the Railway project

1. Create a new Railway project.
2. Add a Redis database service.
3. Add a GitHub repo service for the server.
4. Add a second GitHub repo service for the web client.

### Automated Redis setup

After linking the repo to your Railway project with `railway login` and `railway link`, Redis creation and server variable wiring can be automated:

```bash
npm run railway:setup:redis -- "Orbital Estates Server"
```

The script runs `railway add --database redis` and sets the server variables from the next section, including `REDIS_URL=${{Redis.REDIS_URL}}`.

If Redis already exists, skip creation and only wire variables:

```bash
RAILWAY_SKIP_REDIS_CREATE=true npm run railway:setup:redis -- "Orbital Estates Server"
```

If the Redis service is not named `Redis`, pass its exact Railway service name through `RAILWAY_REDIS_SERVICE`:

```bash
RAILWAY_REDIS_SERVICE="Orbital Redis" RAILWAY_SKIP_REDIS_CREATE=true npm run railway:setup:redis -- "Orbital Estates Server"
```

## 2. Configure the server service

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

## 3. Configure the web service

In the web service settings:

- **Root Directory:** `/`
- **Config File Path:** `/railway.web.toml`

Set variables:

```text
EXPO_PUBLIC_SERVER_URL=https://<server-domain>
```

Deploy the web service and generate a public domain.

## 4. Lock down CORS

After the web domain exists, update the server variable:

```text
CORS_ORIGIN=https://<web-domain>
```

Redeploy the server.

For local testing or early smoke tests, `CORS_ORIGIN=*` is acceptable. Production should use the exact web origin.

## 5. Build commands used by Railway

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

## 6. Smoke test

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
