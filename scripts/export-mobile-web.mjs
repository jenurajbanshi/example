#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolveExpoServerUrl } from "./resolve-expo-server-url.mjs";

const { source, url } = resolveExpoServerUrl();
const env = {
  ...process.env,
  EXPO_PUBLIC_SERVER_URL: url
};

console.log(`Using EXPO_PUBLIC_SERVER_URL=${url} (${source})`);

const result = spawnSync("expo", ["export", "--platform", "web"], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

process.exit(result.status ?? 1);
