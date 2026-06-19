import { describe, expect, it } from "vitest";
import {
  PASS_START_SALARY,
  STARTING_CASH,
  addPlayer,
  createGame,
  purchaseProperty,
  rollDice,
  startGame
} from "./game.js";

describe("Orbital Estates shared game engine", () => {
  it("creates a lobby game with the host identified by device ID", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });

    expect(game.status).toBe("lobby");
    expect(game.hostDeviceId).toBe("device-a");
    expect(game.players).toHaveLength(1);
    expect(game.players[0].cash).toBe(STARTING_CASH);
    expect(game.board).toHaveLength(24);
  });

  it("lets an existing device ID rejoin the lobby instead of duplicating the player", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });
    const joined = addPlayer(game, "device-a", "Ava Prime").state;

    expect(joined.players).toHaveLength(1);
    expect(joined.players[0].displayName).toBe("Ava Prime");
    expect(joined.players[0].connected).toBe(true);
  });

  it("starts with at least two players and assigns the first turn to the host", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });
    const lobby = addPlayer(game, "device-b", "Ben").state;
    const active = startGame(lobby, "device-a").state;

    expect(active.status).toBe("active");
    expect(active.currentTurnDeviceId).toBe("device-a");
  });

  it("wraps movement around the circular board and awards pass-start salary", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });
    const lobby = addPlayer(game, "device-b", "Ben").state;
    const active = startGame(lobby, "device-a").state;
    active.players[0].position = 22;

    const rolled = rollDice(active, "device-a", { dieOne: 3, dieTwo: 2, total: 5 }).state;

    expect(rolled.players[0].position).toBe(3);
    expect(rolled.players[0].cash).toBe(STARTING_CASH + PASS_START_SALARY);
    expect(rolled.pendingAction?.kind).toBe("purchase");
  });

  it("allows the current player to buy an unowned property before the turn advances", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });
    const lobby = addPlayer(game, "device-b", "Ben").state;
    const active = startGame(lobby, "device-a").state;
    const landed = rollDice(active, "device-a", { dieOne: 1, dieTwo: 2, total: 3 }).state;

    expect(landed.pendingAction).toEqual({ kind: "purchase", deviceId: "device-a", tileId: 3 });

    const bought = purchaseProperty(landed, "device-a", true).state;

    expect(bought.players[0].properties).toContain(3);
    expect(bought.players[0].cash).toBe(STARTING_CASH - 100);
    expect(bought.pendingAction).toBeUndefined();
    expect(bought.currentTurnDeviceId).toBe("device-b");
  });

  it("charges rent when another player lands on an owned property", () => {
    const game = createGame({ id: "ABCD12", hostDeviceId: "device-a", hostName: "Ava" });
    const lobby = addPlayer(game, "device-b", "Ben").state;
    const active = startGame(lobby, "device-a").state;
    const landed = rollDice(active, "device-a", { dieOne: 1, dieTwo: 2, total: 3 }).state;
    const bought = purchaseProperty(landed, "device-a", true).state;

    const rentPaid = rollDice(bought, "device-b", { dieOne: 1, dieTwo: 2, total: 3 }).state;

    expect(rentPaid.players[0].cash).toBe(STARTING_CASH - 100 + 16);
    expect(rentPaid.players[1].cash).toBe(STARTING_CASH - 16);
  });
});
