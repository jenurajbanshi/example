import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "orbital-estates-device-id";

export async function getOrCreateDeviceId(): Promise<string> {
  if (Platform.OS === "web") {
    return getOrCreateWebDeviceId();
  }

  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const deviceId = `device:${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);

  return deviceId;
}

function getOrCreateWebDeviceId(): string {
  const existing = globalThis.localStorage?.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const deviceId = `device:${Crypto.randomUUID()}`;
  globalThis.localStorage?.setItem(DEVICE_ID_KEY, deviceId);

  return deviceId;
}
