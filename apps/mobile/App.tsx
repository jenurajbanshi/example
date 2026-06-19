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
  View
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

const DEFAULT_SERVER_URL = "http://localhost:3000";

export default function App(): React.ReactElement {
  const [deviceId, setDeviceId] = useState<string>();
  const [displayName, setDisplayName] = useState("Captain");
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
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

    const client = io(serverUrl, {
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
  }, [deviceId, serverUrl]);

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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Play without an account</Text>
            <Text style={styles.bodyText}>
              This app stores a private device ID locally and uses it to rejoin rooms. No email, password, or profile is
              required.
            </Text>
            <LabeledInput label="Display name" value={displayName} onChangeText={setDisplayName} />
            <LabeledInput
              label="Server URL"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
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
            <View style={styles.card}>
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your turn controls</Text>
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Event log</Text>
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
  const boardSize = 340;
  const center = boardSize / 2;
  const tileRadius = 138;
  const tileSize = 50;

  return (
    <View style={styles.boardCard}>
      <View style={[styles.board, { width: boardSize, height: boardSize, borderRadius: boardSize / 2 }]}>
        <View style={styles.boardCenter}>
          <Text style={styles.boardCenterTitle}>ORBIT</Text>
          <Text style={styles.boardCenterText}>{state.status}</Text>
        </View>
        {state.board.map((tile, index) => {
          const owner = getOwner(state, tile.id);
          const position = getPolarPosition(index, state.board.length, tileRadius, center, tileSize);

          return (
            <View
              key={tile.id}
              style={[
                styles.tile,
                tileStyle(tile),
                {
                  left: position.left,
                  top: position.top,
                  borderColor: owner?.color ?? "#334155"
                }
              ]}
            >
              <Text style={styles.tileNumber}>{tile.id}</Text>
              <Text style={styles.tileName} numberOfLines={2}>
                {shortTileName(tile.name)}
              </Text>
            </View>
          );
        })}
        {state.players.map((player) => {
          const sameSpace = state.players.filter((candidate) => candidate.position === player.position);
          const stackIndex = sameSpace.findIndex((candidate) => candidate.deviceId === player.deviceId);
          const position = getPolarPosition(
            player.position,
            state.board.length,
            tileRadius - 34 - stackIndex * 15,
            center,
            18
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
                  opacity: player.bankrupt ? 0.35 : 1
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
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;

  return {
    left: center + radius * Math.cos(angle) - size / 2,
    top: center + radius * Math.sin(angle) - size / 2
  };
}

function shortTileName(name: string): string {
  return name
    .split(" ")
    .map((part) => part.slice(0, 4))
    .join(" ");
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
    backgroundColor: "#020617"
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
    color: "#cbd5e1"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "900"
  },
  connectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  connected: {
    backgroundColor: "#064e3b"
  },
  disconnected: {
    backgroundColor: "#7f1d1d"
  },
  connectionText: {
    color: "#f8fafc",
    fontWeight: "800"
  },
  error: {
    backgroundColor: "#7f1d1d",
    borderRadius: 12,
    color: "#fee2e2",
    padding: 12
  },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800"
  },
  bodyText: {
    color: "#cbd5e1",
    lineHeight: 20
  },
  inputGroup: {
    gap: 6
  },
  inputLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderRadius: 12,
    borderWidth: 1,
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  divider: {
    backgroundColor: "#1e293b",
    height: 1
  },
  button: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    backgroundColor: "#38bdf8"
  },
  secondaryButton: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
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
    color: "#e2e8f0",
    fontWeight: "800"
  },
  gameCode: {
    color: "#f8fafc",
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
    backgroundColor: "#020617",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  smallToken: {
    borderColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    height: 12,
    width: 12
  },
  playerText: {
    color: "#cbd5e1",
    fontWeight: "700"
  },
  boardCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 18
  },
  board: {
    backgroundColor: "#020617",
    borderColor: "#1e293b",
    borderWidth: 2,
    position: "relative"
  },
  boardCenter: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 72,
    borderWidth: 1,
    height: 144,
    justifyContent: "center",
    left: 98,
    position: "absolute",
    top: 98,
    width: 144
  },
  boardCenterTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 3
  },
  boardCenterText: {
    color: "#38bdf8",
    fontWeight: "800",
    textTransform: "uppercase"
  },
  tile: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    height: 50,
    justifyContent: "center",
    padding: 3,
    position: "absolute",
    width: 50
  },
  startTile: {
    backgroundColor: "#164e63"
  },
  propertyTile: {
    backgroundColor: "#1e293b"
  },
  taxTile: {
    backgroundColor: "#7f1d1d"
  },
  bonusTile: {
    backgroundColor: "#14532d"
  },
  chanceTile: {
    backgroundColor: "#581c87"
  },
  tileNumber: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: "900"
  },
  tileName: {
    color: "#cbd5e1",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center"
  },
  playerToken: {
    borderColor: "#f8fafc",
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    position: "absolute",
    width: 18
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
