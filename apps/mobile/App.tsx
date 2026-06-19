import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { io, type Socket } from "socket.io-client";
import {
  type BoardTile,
  type GameEvent,
  type GameState,
  getOwner,
  isPlayerTurn
} from "@orbital-estates/shared";
import { getOrCreateDeviceId } from "./src/deviceId";

type ServerAck<T> = { ok: true; data: T } | { ok: false; error: string };

type CreateGameResponse = {
  gameId: string;
  state: GameState;
};

type GameUpdatedPayload = {
  state: GameState;
  events: GameEvent[];
};

const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
const TILE_GAP = 5;

export default function App(): React.ReactElement {
  const [deviceId, setDeviceId] = useState<string>();
  const [displayName, setDisplayName] = useState("Captain");
  const [gameCode, setGameCode] = useState("");
  const [gameState, setGameState] = useState<GameState>();
  const [eventFeed, setEventFeed] = useState<GameEvent[]>([]);
  const [socket, setSocket] = useState<Socket>();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getOrCreateDeviceId().then(setDeviceId).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!deviceId) {
      return undefined;
    }

    const client = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true
    });

    client.on("connect", () => setConnected(true));
    client.on("disconnect", () => setConnected(false));
    client.on("gameError", (message: string) => setError(message));
    client.on("gameUpdated", ({ state, events }: GameUpdatedPayload) => {
      setGameState(state);
      setGameCode(state.id);
      setEventFeed((current) => [...events, ...current].slice(0, 20));
    });

    setSocket(client);

    return () => {
      client.disconnect();
      setConnected(false);
    };
  }, [deviceId]);

  const currentPlayer = useMemo(
    () => gameState?.players.find((player) => player.deviceId === deviceId),
    [deviceId, gameState]
  );
  const currentTurnPlayer = useMemo(() => {
    if (!gameState) {
      return undefined;
    }

    return gameState.players.find((player) => player.deviceId === gameState.currentTurnDeviceId);
  }, [gameState]);
  const pendingPurchase =
    gameState && gameState.pendingAction?.deviceId === deviceId ? gameState.pendingAction : undefined;
  const canStart =
    Boolean(gameState && deviceId && gameState.status === "lobby" && gameState.hostDeviceId === deviceId) &&
    (gameState?.players.length ?? 0) >= 2;
  const canRoll = Boolean(gameState && deviceId && isPlayerTurn(gameState, deviceId));

  const emitAck = async <T,>(event: string, payload: Record<string, unknown>): Promise<T> => {
    if (!socket || !connected) {
      throw new Error("Not connected to the game server.");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server did not respond.")), 8000);

      socket.emit(event, payload, (response: ServerAck<T>) => {
        clearTimeout(timeout);

        if (!response.ok) {
          reject(new Error(response.error));
          return;
        }

        resolve(response.data);
      });
    });
  };

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected client error.");
    } finally {
      setBusy(false);
    }
  };

  const createRoom = (): void => {
    void runAction(async () => {
      const response = await emitAck<CreateGameResponse>("createGame", {
        deviceId,
        displayName
      });

      setGameCode(response.gameId);
      setGameState(response.state);
    });
  };

  const joinRoom = (): void => {
    void runAction(async () => {
      const state = await emitAck<GameState>("joinGame", {
        gameId: gameCode.toUpperCase(),
        deviceId,
        displayName
      });

      setGameState(state);
    });
  };

  const startRoom = (): void => {
    void runAction(async () => {
      await emitAck<GameState>("startGame", {
        gameId: gameState?.id,
        deviceId
      });
    });
  };

  const roll = (): void => {
    void runAction(async () => {
      await emitAck<GameState>("rollDice", {
        gameId: gameState?.id,
        deviceId
      });
    });
  };

  const resolvePurchase = (buy: boolean): void => {
    void runAction(async () => {
      await emitAck<GameState>("purchaseProperty", {
        gameId: gameState?.id,
        deviceId,
        buy
      });
    });
  };

  if (!deviceId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <ActivityIndicator color="#38bdf8" size="large" />
          <Text style={styles.loadingText}>Preparing this device for play...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Circular property trading</Text>
            <Text style={styles.title}>Orbital Estates</Text>
          </View>
          <View style={[styles.connectionBadge, connected ? styles.connected : styles.disconnected]}>
            <Text style={styles.connectionText}>{connected ? "Online" : "Offline"}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!gameState ? (
          <View style={styles.heroPanel}>
            <Text style={styles.sectionTitle}>Play without an account</Text>
            <Text style={styles.bodyText}>
              This app stores a private device ID locally and uses it to rejoin rooms. No email, password, or profile is
              required.
            </Text>
            <View style={styles.serverNote}>
              <View style={[styles.statusDot, connected ? styles.connectedDot : styles.disconnectedDot]} />
              <Text style={styles.serverNoteText}>
                {connected ? "Connected" : "Connecting"} to the configured game server.
              </Text>
            </View>
            <LabeledInput label="Display name" value={displayName} onChangeText={setDisplayName} />
            <PrimaryButton disabled={busy || !connected || !displayName.trim()} label="Create game" onPress={createRoom} />
            <View style={styles.divider} />
            <LabeledInput
              label="Join code"
              value={gameCode}
              onChangeText={(value) => setGameCode(value.toUpperCase())}
              autoCapitalize="characters"
            />
            <SecondaryButton disabled={busy || !connected || gameCode.length < 4} label="Join game" onPress={joinRoom} />
          </View>
        ) : (
          <>
            <View style={styles.gameHeader}>
              <Text style={styles.eyebrow}>Game code</Text>
              <Text style={styles.gameCode}>{gameState.id}</Text>
              <Text style={styles.bodyText}>
                Status: {gameState.status.toUpperCase()}{" "}
                {currentTurnPlayer ? `- ${currentTurnPlayer.displayName}'s turn` : ""}
              </Text>
              <View style={styles.playerGrid}>
                {gameState.players.map((player) => (
                  <View key={player.deviceId} style={styles.playerPill}>
                    <View style={[styles.smallToken, { backgroundColor: player.color }]} />
                    <Text style={styles.playerText}>
                      {player.displayName} ${player.cash}
                      {player.bankrupt ? " (bankrupt)" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <CircularBoard state={gameState} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your turn controls</Text>
              {currentPlayer ? (
                <Text style={styles.bodyText}>
                  You are on {gameState.board[currentPlayer.position].name} with ${currentPlayer.cash}.
                </Text>
              ) : null}
              {pendingPurchase ? (
                <View style={styles.actionsRow}>
                  <PrimaryButton disabled={busy} label="Buy property" onPress={() => resolvePurchase(true)} />
                  <SecondaryButton disabled={busy} label="Skip" onPress={() => resolvePurchase(false)} />
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <PrimaryButton disabled={!canRoll || busy} label="Roll dice" onPress={roll} />
                  <SecondaryButton disabled={!canStart || busy} label="Start game" onPress={startRoom} />
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event log</Text>
              {eventFeed.length === 0 ? (
                <Text style={styles.bodyText}>Game events will appear here.</Text>
              ) : (
                eventFeed.map((event, index) => (
                  <Text key={`${event.turn}-${index}-${event.message}`} style={styles.eventText}>
                    T{event.turn}: {event.message}
                  </Text>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CircularBoard({ state }: { state: GameState }): React.ReactElement {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(Math.max(Math.floor(width - 36), 320), 390);
  const center = boardSize / 2;
  const orbitRadius = boardSize * 0.42;
  const tileSize = getCircularTileSize(state.board.length, orbitRadius);
  const centerSize = boardSize * 0.34;
  const centerOffset = (boardSize - centerSize) / 2;
  const tokenSize = 12;

  return (
    <View style={styles.boardWrap}>
      <View style={[styles.board, { width: boardSize, height: boardSize, borderRadius: boardSize / 2 }]}>
        <View
          style={[
            styles.boardCenter,
            {
              borderRadius: centerSize / 2,
              height: centerSize,
              left: centerOffset,
              top: centerOffset,
              width: centerSize
            }
          ]}
        >
          <Text style={styles.boardCenterTitle}>ORBIT</Text>
          <Text style={styles.boardCenterText}>{state.status}</Text>
        </View>
        {state.board.map((tile, index) => {
          const owner = getOwner(state, tile.id);
          const position = getPolarPosition(index, state.board.length, orbitRadius, center, tileSize);

          return (
            <View
              key={tile.id}
              style={[
                styles.tile,
                tileStyle(tile),
                {
                  left: position.left,
                  top: position.top,
                  borderColor: owner?.color ?? getTileAccent(tile),
                  borderRadius: tileSize / 2,
                  height: tileSize,
                  width: tileSize
                }
              ]}
            >
              <Text style={[styles.tileGlyph, { fontSize: tileSize > 36 ? 13 : 11 }]}>{tileGlyph(tile)}</Text>
              <Text style={styles.tileName} numberOfLines={1}>
                {tileLabel(tile)}
              </Text>
            </View>
          );
        })}
        {state.players.map((player) => {
          const sameSpace = state.players.filter((candidate) => candidate.position === player.position);
          const stackIndex = sameSpace.findIndex((candidate) => candidate.deviceId === player.deviceId);
          const position = getStackedTokenPosition(
            player.position,
            state.board.length,
            orbitRadius - tileSize / 2 - 13,
            center,
            tokenSize,
            stackIndex,
            sameSpace.length
          );

          return (
            <View
              key={player.deviceId}
              style={[
                styles.playerToken,
                {
                  left: position.left,
                  top: position.top,
                  backgroundColor: player.color,
                  borderRadius: tokenSize / 2,
                  height: tokenSize,
                  opacity: player.bankrupt ? 0.35 : 1,
                  width: tokenSize
                }
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "url";
}): React.ReactElement {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        placeholderTextColor="#64748b"
      />
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable style={[styles.button, styles.primaryButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  disabled,
  onPress
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable style={[styles.button, styles.secondaryButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function getPolarPosition(index: number, count: number, radius: number, center: number, size: number): { left: number; top: number } {
  const angle = getAngle(index, count);

  return {
    left: center + radius * Math.cos(angle) - size / 2,
    top: center + radius * Math.sin(angle) - size / 2
  };
}

function getStackedTokenPosition(
  index: number,
  count: number,
  radius: number,
  center: number,
  size: number,
  stackIndex: number,
  stackCount: number
): { left: number; top: number } {
  const angle = getAngle(index, count);
  const tangentAngle = angle + Math.PI / 2;
  const tangentOffset = (stackIndex - (stackCount - 1) / 2) * (size + 2);

  return {
    left: center + radius * Math.cos(angle) + tangentOffset * Math.cos(tangentAngle) - size / 2,
    top: center + radius * Math.sin(angle) + tangentOffset * Math.sin(tangentAngle) - size / 2
  };
}

function getAngle(index: number, count: number): number {
  return (index / count) * Math.PI * 2 - Math.PI / 2;
}

function getCircularTileSize(count: number, radius: number): number {
  const maxDiameter = 2 * radius * Math.sin(Math.PI / count) - TILE_GAP;
  return Math.floor(Math.max(30, Math.min(42, maxDiameter)));
}

function tileGlyph(tile: BoardTile): string {
  switch (tile.kind) {
    case "start":
      return "GO";
    case "property":
      return "$";
    case "tax":
      return "%";
    case "bonus":
      return "+";
    case "chance":
      return "?";
  }
}

function tileLabel(tile: BoardTile): string {
  if (tile.kind !== "property") {
    return tile.kind.toUpperCase().slice(0, 3);
  }

  return tile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getTileAccent(tile: BoardTile): string {
  switch (tile.kind) {
    case "start":
      return "#38bdf8";
    case "property":
      return "#64748b";
    case "tax":
      return "#fb7185";
    case "bonus":
      return "#34d399";
    case "chance":
      return "#a78bfa";
  }
}

function tileStyle(tile: BoardTile): object {
  switch (tile.kind) {
    case "start":
      return styles.startTile;
    case "property":
      return styles.propertyTile;
    case "tax":
      return styles.taxTile;
    case "bonus":
      return styles.bonusTile;
    case "chance":
      return styles.chanceTile;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070b12"
  },
  container: {
    padding: 18,
    gap: 16
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingText: {
    color: "#d6dee9"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    color: "#76e4f7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: "#f7fafc",
    fontSize: 34,
    fontWeight: "900"
  },
  connectionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  connected: {
    backgroundColor: "rgba(20, 83, 45, 0.45)",
    borderColor: "#22c55e"
  },
  disconnected: {
    backgroundColor: "rgba(127, 29, 29, 0.45)",
    borderColor: "#f87171"
  },
  connectionText: {
    color: "#f7fafc",
    fontWeight: "800"
  },
  error: {
    backgroundColor: "#7f1d1d",
    borderRadius: 12,
    color: "#fee2e2",
    padding: 12
  },
  heroPanel: {
    backgroundColor: "#101723",
    borderColor: "#263244",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  section: {
    borderColor: "#223044",
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 16
  },
  sectionTitle: {
    color: "#f7fafc",
    fontSize: 20,
    fontWeight: "800"
  },
  bodyText: {
    color: "#b8c2d4",
    lineHeight: 20
  },
  serverNote: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderColor: "#223044",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  connectedDot: {
    backgroundColor: "#22c55e"
  },
  disconnectedDot: {
    backgroundColor: "#f87171"
  },
  serverNoteText: {
    color: "#d6dee9",
    flex: 1,
    fontWeight: "700"
  },
  inputGroup: {
    gap: 6
  },
  inputLabel: {
    color: "#9aa8ba",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "#0a101a",
    borderColor: "#29364a",
    borderRadius: 16,
    borderWidth: 1,
    color: "#f7fafc",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  divider: {
    backgroundColor: "#223044",
    height: 1
  },
  button: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    backgroundColor: "#67e8f9"
  },
  secondaryButton: {
    backgroundColor: "#111827",
    borderColor: "#29364a",
    borderWidth: 1
  },
  disabledButton: {
    opacity: 0.45
  },
  primaryButtonText: {
    color: "#082f49",
    fontWeight: "900"
  },
  secondaryButtonText: {
    color: "#e5edf7",
    fontWeight: "800"
  },
  gameHeader: {
    gap: 12,
    paddingBottom: 4
  },
  gameCode: {
    color: "#f7fafc",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6
  },
  playerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  playerPill: {
    alignItems: "center",
    backgroundColor: "#101723",
    borderColor: "#223044",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  smallToken: {
    borderColor: "#f7fafc",
    borderRadius: 6,
    borderWidth: 1,
    height: 12,
    width: 12
  },
  playerText: {
    color: "#d6dee9",
    fontWeight: "700"
  },
  boardWrap: {
    alignItems: "center",
    paddingVertical: 8
  },
  board: {
    backgroundColor: "#09111f",
    borderColor: "#223044",
    borderWidth: 2,
    position: "relative"
  },
  boardCenter: {
    alignItems: "center",
    backgroundColor: "#101723",
    borderColor: "#263244",
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18
  },
  boardCenterTitle: {
    color: "#f7fafc",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3
  },
  boardCenterText: {
    color: "#76e4f7",
    fontWeight: "800",
    textTransform: "uppercase"
  },
  tile: {
    alignItems: "center",
    borderWidth: 2,
    justifyContent: "center",
    padding: 3,
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  startTile: {
    backgroundColor: "#0d3b4a"
  },
  propertyTile: {
    backgroundColor: "#121a27"
  },
  taxTile: {
    backgroundColor: "#4a1620"
  },
  bonusTile: {
    backgroundColor: "#123821"
  },
  chanceTile: {
    backgroundColor: "#2e1b4f"
  },
  tileGlyph: {
    color: "#f7fafc",
    fontWeight: "900"
  },
  tileName: {
    color: "#b8c2d4",
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center"
  },
  playerToken: {
    borderColor: "#f7fafc",
    borderWidth: 2,
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 5
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10
  },
  eventText: {
    color: "#cbd5e1",
    lineHeight: 20
  }
});
