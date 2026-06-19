#!/usr/bin/env node

const DEFAULT_LOCAL_SERVER_URL = "http://localhost:3000";

const SERVER_URL_CANDIDATES = [
  "EXPO_PUBLIC_SERVER_URL",
  "SERVER_PUBLIC_URL",
  "RAILWAY_SERVER_PUBLIC_URL",
  "SERVER_PUBLIC_DOMAIN",
  "RAILWAY_SERVER_PUBLIC_DOMAIN"
];

export function resolveExpoServerUrl(env = process.env) {
  for (const name of SERVER_URL_CANDIDATES) {
    const rawValue = env[name]?.trim();

    if (!rawValue) {
      continue;
    }

    return {
      source: name,
      url: normalizeServerUrl(rawValue)
    };
  }

  return {
    source: "default",
    url: DEFAULT_LOCAL_SERVER_URL
  };
}

export function normalizeServerUrl(rawValue) {
  const value = rawValue.trim().replace(/\/+$/, "");

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const isLocal =
    value.startsWith("localhost") || value.startsWith("127.0.0.1") || value.startsWith("0.0.0.0");

  return `${isLocal ? "http" : "https"}://${value}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { source, url } = resolveExpoServerUrl();
  console.log(`${source}=${url}`);
}
