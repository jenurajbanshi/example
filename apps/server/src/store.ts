import type { GameState } from "@orbital-estates/shared";
import { Redis } from "ioredis";

export type GameStore = {
  create(game: GameState): Promise<boolean>;
  get(gameId: string): Promise<GameState | undefined>;
  save(game: GameState): Promise<void>;
};

export class InMemoryGameStore implements GameStore {
  private readonly games = new Map<string, GameState>();

  async create(game: GameState): Promise<boolean> {
    if (this.games.has(game.id)) {
      return false;
    }

    this.games.set(game.id, game);
    return true;
  }

  async get(gameId: string): Promise<GameState | undefined> {
    return this.games.get(normalizeGameId(gameId));
  }

  async save(game: GameState): Promise<void> {
    this.games.set(game.id, game);
  }
}

export class RedisGameStore implements GameStore {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix: string,
    private readonly ttlSeconds: number
  ) {}

  async create(game: GameState): Promise<boolean> {
    const result = await this.redis.set(this.key(game.id), JSON.stringify(game), "EX", this.ttlSeconds, "NX");
    return result === "OK";
  }

  async get(gameId: string): Promise<GameState | undefined> {
    const payload = await this.redis.get(this.key(gameId));

    if (!payload) {
      return undefined;
    }

    return JSON.parse(payload) as GameState;
  }

  async save(game: GameState): Promise<void> {
    await this.redis.set(this.key(game.id), JSON.stringify(game), "EX", this.ttlSeconds);
  }

  private key(gameId: string): string {
    return `${this.keyPrefix}:game:${normalizeGameId(gameId)}`;
  }
}

export function createGameStore(options: {
  redisUrl?: string;
  redisKeyPrefix: string;
  gameTtlSeconds: number;
}): { store: GameStore; redis?: Redis } {
  if (!options.redisUrl) {
    return { store: new InMemoryGameStore() };
  }

  const redis = new Redis(options.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 2
  });

  return {
    redis,
    store: new RedisGameStore(redis, options.redisKeyPrefix, options.gameTtlSeconds)
  };
}

export function normalizeGameId(gameId: string): string {
  return gameId.trim().toUpperCase();
}
