import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "orbital-estates-device-id";

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const deviceId = `device:${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);

  return deviceId;
}
