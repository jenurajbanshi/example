import {
  addPlayer,
  createDiceRoll,
  createGame,
  purchaseProperty,
  rollDice,
  setPlayerConnection,
  startGame,
  type GameCommandResult,
  type GameEvent,
  type GameState
} from "@orbital-estates/shared";
import { customAlphabet } from "nanoid";
import type { Server, Socket } from "socket.io";
import { z, ZodError } from "zod";
import type { GameStore } from "./store.js";
import { normalizeGameId } from "./store.js";

type Ack<T> = (response: { ok: true; data: T } | { ok: false; error: string }) => void;

export type CreateGameResponse = {
  gameId: string;
  state: GameState;
};

const gameIdGenerator = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const deviceIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9._:-]+$/, "Device ID contains unsupported characters.");

const displayNameSchema = z.string().trim().min(1).max(24);
const gameIdSchema = z.string().trim().min(4).max(12).regex(/^[a-zA-Z0-9]+$/);

const createGameSchema = z.object({
  deviceId: deviceIdSchema,
  displayName: displayNameSchema
});

const gameCommandSchema = z.object({
  gameId: gameIdSchema,
  deviceId: deviceIdSchema
});

const joinGameSchema = gameCommandSchema.extend({
  displayName: displayNameSchema
});

const purchaseSchema = gameCommandSchema.extend({
  buy: z.boolean()
});

export function registerRealtime(io: Server, store: GameStore): void {
  io.on("connection", (socket) => {
    socket.on("createGame", async (payload, ack?: Ack<CreateGameResponse>) => {
      await runCommand(socket, ack, async () => {
        const input = createGameSchema.parse(payload);
        const state = await createUniqueGame(store, input.deviceId, input.displayName);

        rememberSocket(socket, state.id, input.deviceId);
        await socket.join(state.id);
        emitGameUpdated(io, state, state.events.slice(-1));

        return { gameId: state.id, state };
      });
    });

    socket.on("joinGame", async (payload, ack?: Ack<GameState>) => {
      await runCommand(socket, ack, async () => {
        const input = joinGameSchema.parse(payload);
        const game = await requireGame(store, input.gameId);
        const result = addPlayer(game, input.deviceId, input.displayName);

        await store.save(result.state);
        rememberSocket(socket, result.state.id, input.deviceId);
        await socket.join(result.state.id);
        emitGameUpdated(io, result.state, result.events);

        return result.state;
      });
    });

    socket.on("startGame", async (payload, ack?: Ack<GameState>) => {
      await runGameCommand(io, store, socket, ack, payload, (state, deviceId) => startGame(state, deviceId));
    });

    socket.on("rollDice", async (payload, ack?: Ack<GameState>) => {
      await runGameCommand(io, store, socket, ack, payload, (state, deviceId) =>
        rollDice(state, deviceId, createDiceRoll())
      );
    });

    socket.on("purchaseProperty", async (payload, ack?: Ack<GameState>) => {
      await runCommand(socket, ack, async () => {
        const input = purchaseSchema.parse(payload);
        const game = await requireGame(store, input.gameId);
        const result = purchaseProperty(game, input.deviceId, input.buy);

        await store.save(result.state);
        emitGameUpdated(io, result.state, result.events);

        return result.state;
      });
    });

    socket.on("disconnect", async () => {
      const { gameId, deviceId } = socket.data as { gameId?: string; deviceId?: string };

      if (!gameId || !deviceId) {
        return;
      }

      try {
        const game = await store.get(gameId);

        if (!game) {
          return;
        }

        const result = setPlayerConnection(game, deviceId, false);
        await store.save(result.state);
        emitGameUpdated(io, result.state, result.events);
      } catch {
        // The socket is already closing; stale room state can be repaired on reconnect.
      }
    });
  });
}

async function runGameCommand(
  io: Server,
  store: GameStore,
  socket: Socket,
  ack: Ack<GameState> | undefined,
  payload: unknown,
  command: (state: GameState, deviceId: string) => GameCommandResult
): Promise<void> {
  await runCommand(socket, ack, async () => {
    const input = gameCommandSchema.parse(payload);
    const game = await requireGame(store, input.gameId);
    const result = command(game, input.deviceId);

    await store.save(result.state);
    rememberSocket(socket, result.state.id, input.deviceId);
    emitGameUpdated(io, result.state, result.events);

    return result.state;
  });
}

async function runCommand<T>(socket: Socket, ack: Ack<T> | undefined, command: () => Promise<T>): Promise<void> {
  try {
    const data = await command();
    ack?.({ ok: true, data });
  } catch (error) {
    const message = formatError(error);
    ack?.({ ok: false, error: message });
    socket.emit("gameError", message);
  }
}

async function createUniqueGame(store: GameStore, hostDeviceId: string, hostName: string): Promise<GameState> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = gameIdGenerator();
    const game = createGame({ id, hostDeviceId, hostName });

    if (await store.create(game)) {
      return game;
    }
  }

  throw new Error("Could not allocate a game code. Please try again.");
}

async function requireGame(store: GameStore, gameId: string): Promise<GameState> {
  const game = await store.get(normalizeGameId(gameId));

  if (!game) {
    throw new Error("Game not found.");
  }

  return game;
}

function emitGameUpdated(io: Server, state: GameState, events: GameEvent[]): void {
  io.to(state.id).emit("gameUpdated", {
    state,
    events
  });
}

function rememberSocket(socket: Socket, gameId: string, deviceId: string): void {
  socket.data.gameId = gameId;
  socket.data.deviceId = deviceId;
}

function formatError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected server error.";
}
