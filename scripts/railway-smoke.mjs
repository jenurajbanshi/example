#!/usr/bin/env node

const usage = `Usage:
  npm run railway:smoke -- <server-url> <web-url>

Environment variables:
  EXPECT_REDIS_STORAGE  Require /health storage to be "redis".
                        Default: true
`;

if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(usage);
  process.exit(0);
}

const [, , serverArg, webArg] = process.argv;

if (!serverArg || !webArg) {
  console.error(usage);
  process.exit(1);
}

const expectRedisStorage = process.env.EXPECT_REDIS_STORAGE !== "false";

function normalizeUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkServer(serverUrl) {
  const healthUrl = new URL("/health", serverUrl);
  const response = await fetchWithTimeout(healthUrl);

  if (!response.ok) {
    throw new Error(`Server health returned HTTP ${response.status}`);
  }

  const health = await response.json();

  if (health.ok !== true) {
    throw new Error(`Server health did not report ok=true: ${JSON.stringify(health)}`);
  }

  if (expectRedisStorage && health.storage !== "redis") {
    throw new Error(`Expected Redis storage, received: ${health.storage ?? "missing"}`);
  }

  console.log(`Server health OK (${health.storage ?? "unknown"} storage).`);
}

async function checkWeb(webUrl) {
  const response = await fetchWithTimeout(webUrl);

  if (!response.ok) {
    throw new Error(`Web app returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!contentType.includes("text/html") && !body.toLowerCase().includes("<html")) {
    throw new Error("Web app did not return HTML.");
  }

  console.log("Web app responded with HTML.");
}

try {
  const serverUrl = normalizeUrl(serverArg);
  const webUrl = normalizeUrl(webArg);

  await checkServer(serverUrl);
  await checkWeb(webUrl);
  console.log("Railway smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
