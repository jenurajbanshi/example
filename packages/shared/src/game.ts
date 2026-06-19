export type DeviceId = string;

export type GameStatus = "lobby" | "active" | "ended";

export type TileKind = "start" | "property" | "tax" | "bonus" | "chance";

export type BoardTile =
  | {
      id: number;
      kind: "start";
      name: string;
      salary: number;
    }
  | {
      id: number;
      kind: "property";
      name: string;
      set: "solar" | "lunar" | "nebula" | "comet" | "aurora" | "zenith";
      price: number;
      rent: number;
    }
  | {
      id: number;
      kind: "tax";
      name: string;
      amount: number;
    }
  | {
      id: number;
      kind: "bonus";
      name: string;
      amount: number;
    }
  | {
      id: number;
      kind: "chance";
      name: string;
    };

export type Player = {
  deviceId: DeviceId;
  displayName: string;
  color: string;
  position: number;
  cash: number;
  properties: number[];
  connected: boolean;
  bankrupt: boolean;
};

export type DiceRoll = {
  dieOne: number;
  dieTwo: number;
  total: number;
};

export type PendingAction = {
  kind: "purchase";
  deviceId: DeviceId;
  tileId: number;
};

export type GameEvent = {
  turn: number;
  message: string;
};

export type GameState = {
  id: string;
  status: GameStatus;
  board: BoardTile[];
  players: Player[];
  hostDeviceId: DeviceId;
  currentTurnDeviceId?: DeviceId;
  pendingAction?: PendingAction;
  lastRoll?: DiceRoll;
  turnNumber: number;
  createdAt: string;
  updatedAt: string;
  winnerDeviceId?: DeviceId;
  events: GameEvent[];
};

export type GameCommandResult = {
  state: GameState;
  events: GameEvent[];
};

export type CreateGameInput = {
  id: string;
  hostDeviceId: DeviceId;
  hostName: string;
};

export const BOARD_SIZE = 24;
export const MAX_PLAYERS = 6;
export const STARTING_CASH = 1500;
export const PASS_START_SALARY = 200;

const PLAYER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6"
];

export function createDefaultBoard(): BoardTile[] {
  return [
    { id: 0, kind: "start", name: "Launch Gate", salary: PASS_START_SALARY },
    { id: 1, kind: "property", name: "Solar Pier", set: "solar", price: 80, rent: 12 },
    { id: 2, kind: "bonus", name: "Investor Dividend", amount: 75 },
    { id: 3, kind: "property", name: "Mercury Market", set: "solar", price: 100, rent: 16 },
    { id: 4, kind: "tax", name: "Docking Fee", amount: 90 },
    { id: 5, kind: "property", name: "Moonlit Row", set: "lunar", price: 120, rent: 20 },
    { id: 6, kind: "chance", name: "Orbit Card" },
    { id: 7, kind: "property", name: "Crater Court", set: "lunar", price: 140, rent: 24 },
    { id: 8, kind: "bonus", name: "Cargo Rebate", amount: 100 },
    { id: 9, kind: "property", name: "Nebula Nook", set: "nebula", price: 160, rent: 30 },
    { id: 10, kind: "tax", name: "Station Repairs", amount: 120 },
    { id: 11, kind: "property", name: "Stardust Plaza", set: "nebula", price: 180, rent: 36 },
    { id: 12, kind: "chance", name: "Wormhole Card" },
    { id: 13, kind: "property", name: "Comet Crossing", set: "comet", price: 200, rent: 42 },
    { id: 14, kind: "bonus", name: "Mining Royalty", amount: 125 },
    { id: 15, kind: "property", name: "Tailwind Terrace", set: "comet", price: 220, rent: 48 },
    { id: 16, kind: "tax", name: "Fuel Surcharge", amount: 150 },
    { id: 17, kind: "property", name: "Aurora Avenue", set: "aurora", price: 240, rent: 56 },
    { id: 18, kind: "chance", name: "Gravity Card" },
    { id: 19, kind: "property", name: "Polar Promenade", set: "aurora", price: 260, rent: 64 },
    { id: 20, kind: "bonus", name: "Tourism Boom", amount: 150 },
    { id: 21, kind: "property", name: "Zenith Zone", set: "zenith", price: 300, rent: 75 },
    { id: 22, kind: "tax", name: "Cosmic Tariff", amount: 180 },
    { id: 23, kind: "property", name: "Apex Arcade", set: "zenith", price: 340, rent: 90 }
  ];
}

export function createGame(input: CreateGameInput): GameState {
  const now = new Date().toISOString();
  const state: GameState = {
    id: input.id,
    status: "lobby",
    board: createDefaultBoard(),
    players: [
      {
        deviceId: input.hostDeviceId,
        displayName: input.hostName,
        color: PLAYER_COLORS[0],
        position: 0,
        cash: STARTING_CASH,
        properties: [],
        connected: true,
        bankrupt: false
      }
    ],
    hostDeviceId: input.hostDeviceId,
    turnNumber: 0,
    createdAt: now,
    updatedAt: now,
    events: [{ turn: 0, message: `${input.hostName} created the game.` }]
  };

  return state;
}

export function addPlayer(state: GameState, deviceId: DeviceId, displayName: string): GameCommandResult {
  assertStatus(state, "lobby");

  const next = cloneState(state);
  const existing = next.players.find((player) => player.deviceId === deviceId);

  if (existing) {
    existing.displayName = displayName;
    existing.connected = true;
    return commit(next, `${displayName} rejoined the lobby.`);
  }

  if (next.players.length >= MAX_PLAYERS) {
    throw new Error(`This game already has the maximum of ${MAX_PLAYERS} players.`);
  }

  next.players.push({
    deviceId,
    displayName,
    color: PLAYER_COLORS[next.players.length % PLAYER_COLORS.length],
    position: 0,
    cash: STARTING_CASH,
    properties: [],
    connected: true,
    bankrupt: false
  });

  return commit(next, `${displayName} joined the lobby.`);
}

export function setPlayerConnection(state: GameState, deviceId: DeviceId, connected: boolean): GameCommandResult {
  const next = cloneState(state);
  const player = findPlayer(next, deviceId);
  player.connected = connected;

  return commit(next, `${player.displayName} ${connected ? "reconnected" : "disconnected"}.`);
}

export function startGame(state: GameState, deviceId: DeviceId): GameCommandResult {
  assertStatus(state, "lobby");

  if (state.hostDeviceId !== deviceId) {
    throw new Error("Only the host can start this game.");
  }

  if (state.players.length < 2) {
    throw new Error("At least two players are required to start.");
  }

  const next = cloneState(state);
  next.status = "active";
  next.currentTurnDeviceId = next.players[0].deviceId;

  return commit(next, "The game has started.");
}

export function rollDice(state: GameState, deviceId: DeviceId, dice: DiceRoll): GameCommandResult {
  assertStatus(state, "active");
  assertCurrentTurn(state, deviceId);

  if (state.pendingAction) {
    throw new Error("Resolve the pending action before rolling again.");
  }

  validateDice(dice);

  const next = cloneState(state);
  const playerIndex = next.players.findIndex((player) => player.deviceId === deviceId);
  const player = next.players[playerIndex];
  const previousPosition = player.position;
  const rawPosition = previousPosition + dice.total;
  const passedStart = rawPosition >= next.board.length;

  player.position = rawPosition % next.board.length;
  next.lastRoll = dice;

  const events: string[] = [
    `${player.displayName} rolled ${dice.dieOne} + ${dice.dieTwo} and moved to ${next.board[player.position].name}.`
  ];

  if (passedStart) {
    player.cash += PASS_START_SALARY;
    events.push(`${player.displayName} passed Launch Gate and collected ${formatMoney(PASS_START_SALARY)}.`);
  }

  resolveLanding(next, playerIndex, events);
  maybeEndGame(next, events);

  if (!next.pendingAction && next.status === "active") {
    advanceTurn(next, events);
  }

  return commit(next, events);
}

export function purchaseProperty(state: GameState, deviceId: DeviceId, buy: boolean): GameCommandResult {
  assertStatus(state, "active");

  if (!state.pendingAction || state.pendingAction.kind !== "purchase") {
    throw new Error("There is no property purchase to resolve.");
  }

  if (state.pendingAction.deviceId !== deviceId) {
    throw new Error("Only the current player can resolve this purchase.");
  }

  const action = state.pendingAction;
  const next = cloneState(state);
  const player = findPlayer(next, deviceId);
  const tile = next.board[action.tileId];
  const events: string[] = [];

  if (!tile || tile.kind !== "property") {
    throw new Error("The pending purchase tile is invalid.");
  }

  if (buy) {
    if (getOwner(next, tile.id)) {
      throw new Error("This property is already owned.");
    }

    if (player.cash < tile.price) {
      throw new Error("You do not have enough cash to buy this property.");
    }

    player.cash -= tile.price;
    player.properties.push(tile.id);
    events.push(`${player.displayName} bought ${tile.name} for ${formatMoney(tile.price)}.`);
  } else {
    events.push(`${player.displayName} skipped buying ${tile.name}.`);
  }

  delete next.pendingAction;
  advanceTurn(next, events);

  return commit(next, events);
}

export function createDiceRoll(random: () => number = Math.random): DiceRoll {
  const dieOne = Math.floor(random() * 6) + 1;
  const dieTwo = Math.floor(random() * 6) + 1;

  return {
    dieOne,
    dieTwo,
    total: dieOne + dieTwo
  };
}

export function getOwner(state: GameState, tileId: number): Player | undefined {
  return state.players.find((player) => player.properties.includes(tileId));
}

export function isPlayerTurn(state: GameState, deviceId: DeviceId): boolean {
  return state.status === "active" && state.currentTurnDeviceId === deviceId && !state.pendingAction;
}

function resolveLanding(state: GameState, playerIndex: number, events: string[]): void {
  const player = state.players[playerIndex];
  const tile = state.board[player.position];

  switch (tile.kind) {
    case "start":
      player.cash += tile.salary;
      events.push(`${player.displayName} landed on Launch Gate and collected ${formatMoney(tile.salary)}.`);
      break;
    case "property":
      resolveProperty(state, player, tile, events);
      break;
    case "tax":
      player.cash -= tile.amount;
      events.push(`${player.displayName} paid ${formatMoney(tile.amount)} for ${tile.name}.`);
      bankruptIfNeeded(state, player, events);
      break;
    case "bonus":
      player.cash += tile.amount;
      events.push(`${player.displayName} collected ${formatMoney(tile.amount)} from ${tile.name}.`);
      break;
    case "chance":
      resolveChance(state, playerIndex, events);
      break;
  }
}

function resolveProperty(state: GameState, player: Player, tile: Extract<BoardTile, { kind: "property" }>, events: string[]): void {
  const owner = getOwner(state, tile.id);

  if (!owner) {
    if (player.cash >= tile.price) {
      state.pendingAction = {
        kind: "purchase",
        deviceId: player.deviceId,
        tileId: tile.id
      };
      events.push(`${player.displayName} can buy ${tile.name} for ${formatMoney(tile.price)}.`);
    } else {
      events.push(`${player.displayName} cannot afford ${tile.name}.`);
    }
    return;
  }

  if (owner.deviceId === player.deviceId || owner.bankrupt) {
    events.push(`${player.displayName} landed on their own ${tile.name}.`);
    return;
  }

  player.cash -= tile.rent;
  owner.cash += tile.rent;
  events.push(`${player.displayName} paid ${formatMoney(tile.rent)} rent to ${owner.displayName} for ${tile.name}.`);
  bankruptIfNeeded(state, player, events);
}

function resolveChance(state: GameState, playerIndex: number, events: string[]): void {
  const player = state.players[playerIndex];
  const cardIndex = (state.turnNumber + player.position + (state.lastRoll?.total ?? 0)) % 6;

  switch (cardIndex) {
    case 0:
      player.cash += 120;
      events.push(`${player.displayName} drew Sponsor Boost and collected ${formatMoney(120)}.`);
      break;
    case 1:
      player.cash -= 100;
      events.push(`${player.displayName} drew Hull Patch and paid ${formatMoney(100)}.`);
      bankruptIfNeeded(state, player, events);
      break;
    case 2:
      movePlayer(state, playerIndex, 3, events, "slingshot forward 3 spaces");
      resolveLanding(state, playerIndex, events);
      break;
    case 3:
      player.position = 0;
      player.cash += PASS_START_SALARY;
      events.push(`${player.displayName} warped to Launch Gate and collected ${formatMoney(PASS_START_SALARY)}.`);
      break;
    case 4:
      collectFromEachPlayer(state, player, 50, events);
      break;
    case 5:
      payEachPlayer(state, player, 25, events);
      bankruptIfNeeded(state, player, events);
      break;
  }
}

function movePlayer(state: GameState, playerIndex: number, spaces: number, events: string[], reason: string): void {
  const player = state.players[playerIndex];
  const rawPosition = player.position + spaces;

  player.position = rawPosition % state.board.length;
  events.push(`${player.displayName} used ${reason} and moved to ${state.board[player.position].name}.`);

  if (rawPosition >= state.board.length) {
    player.cash += PASS_START_SALARY;
    events.push(`${player.displayName} passed Launch Gate and collected ${formatMoney(PASS_START_SALARY)}.`);
  }
}

function collectFromEachPlayer(state: GameState, player: Player, amount: number, events: string[]): void {
  for (const other of state.players) {
    if (other.deviceId === player.deviceId || other.bankrupt) {
      continue;
    }

    other.cash -= amount;
    player.cash += amount;
    events.push(`${other.displayName} paid ${formatMoney(amount)} to ${player.displayName}.`);
    bankruptIfNeeded(state, other, events);
  }
}

function payEachPlayer(state: GameState, player: Player, amount: number, events: string[]): void {
  for (const other of state.players) {
    if (other.deviceId === player.deviceId || other.bankrupt) {
      continue;
    }

    player.cash -= amount;
    other.cash += amount;
    events.push(`${player.displayName} paid ${formatMoney(amount)} to ${other.displayName}.`);
  }
}

function bankruptIfNeeded(state: GameState, player: Player, events: string[]): void {
  if (player.cash >= 0 || player.bankrupt) {
    return;
  }

  player.bankrupt = true;
  player.properties = [];
  events.push(`${player.displayName} went bankrupt and their properties returned to the orbit.`);
}

function maybeEndGame(state: GameState, events: string[]): void {
  const activePlayers = state.players.filter((player) => !player.bankrupt);

  if (activePlayers.length === 1) {
    const [winner] = activePlayers;
    state.status = "ended";
    state.winnerDeviceId = winner.deviceId;
    state.currentTurnDeviceId = undefined;
    delete state.pendingAction;
    events.push(`${winner.displayName} wins Orbital Estates.`);
  }
}

function advanceTurn(state: GameState, events: string[]): void {
  const currentIndex = state.players.findIndex((player) => player.deviceId === state.currentTurnDeviceId);

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const nextPlayer = state.players[(currentIndex + offset) % state.players.length];

    if (!nextPlayer.bankrupt) {
      state.currentTurnDeviceId = nextPlayer.deviceId;
      state.turnNumber += 1;
      events.push(`It is ${nextPlayer.displayName}'s turn.`);
      return;
    }
  }
}

function validateDice(dice: DiceRoll): void {
  const values = [dice.dieOne, dice.dieTwo];

  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) {
    throw new Error("Dice values must be integers from 1 through 6.");
  }

  if (dice.total !== dice.dieOne + dice.dieTwo) {
    throw new Error("Dice total must equal the sum of both dice.");
  }
}

function assertStatus(state: GameState, status: GameStatus): void {
  if (state.status !== status) {
    throw new Error(`Game must be ${status}; it is currently ${state.status}.`);
  }
}

function assertCurrentTurn(state: GameState, deviceId: DeviceId): void {
  if (state.currentTurnDeviceId !== deviceId) {
    throw new Error("It is not your turn.");
  }

  const player = findPlayer(state, deviceId);

  if (player.bankrupt) {
    throw new Error("Bankrupt players cannot take turns.");
  }
}

function findPlayer(state: GameState, deviceId: DeviceId): Player {
  const player = state.players.find((candidate) => candidate.deviceId === deviceId);

  if (!player) {
    throw new Error("Player not found in this game.");
  }

  return player;
}

function commit(state: GameState, messages: string | string[]): GameCommandResult {
  const nextMessages = Array.isArray(messages) ? messages : [messages];
  const events = nextMessages.map((message) => ({
    turn: state.turnNumber,
    message
  }));

  state.updatedAt = new Date().toISOString();
  state.events = [...state.events, ...events].slice(-50);

  return {
    state,
    events
  };
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function formatMoney(amount: number): string {
  return `$${amount}`;
}
