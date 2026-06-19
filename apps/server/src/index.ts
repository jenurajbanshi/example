import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createAdapter } from "@socket.io/redis-adapter";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { Server } from "socket.io";
import { loadConfig, parseCorsOrigin } from "./config.js";
import { registerRealtime } from "./realtime.js";
import { createGameStore, normalizeGameId } from "./store.js";

const config = loadConfig();
const app = Fastify({
  logger: true,
  trustProxy: config.TRUST_PROXY
});
const corsOrigin = parseCorsOrigin(config.CORS_ORIGIN);
const { store, redis } = createGameStore({
  redisUrl: config.REDIS_URL,
  redisKeyPrefix: config.REDIS_KEY_PREFIX,
  gameTtlSeconds: config.GAME_TTL_SECONDS
});

await app.register(helmet, {
  contentSecurityPolicy: config.NODE_ENV === "production" ? undefined : false
});
await app.register(cors, {
  origin: corsOrigin
});
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute"
});

app.get("/health", async () => ({
  ok: true,
  service: "orbital-estates-server",
  realtime: "socket.io",
  storage: config.REDIS_URL ? "redis" : "memory"
}));

app.get<{ Params: { gameId: string } }>("/games/:gameId", async (request, reply) => {
  const game = await store.get(normalizeGameId(request.params.gameId));

  if (!game) {
    return reply.code(404).send({ error: "Game not found." });
  }

  return { state: game };
});

const io = new Server(app.server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const pubClient = config.REDIS_URL ? new Redis(config.REDIS_URL) : undefined;
const subClient = pubClient?.duplicate();

if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
}

registerRealtime(io, store);

const shutdown = async (): Promise<void> => {
  app.log.info("Shutting down Orbital Estates server.");
  io.close();
  await Promise.allSettled([app.close(), redis?.quit(), pubClient?.quit(), subClient?.quit()]);
};

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
