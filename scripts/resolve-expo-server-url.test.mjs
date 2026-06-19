import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeServerUrl, resolveExpoServerUrl } from "./resolve-expo-server-url.mjs";

describe("resolveExpoServerUrl", () => {
  it("prefers an explicit Expo public URL", () => {
    assert.deepEqual(
      resolveExpoServerUrl({
        EXPO_PUBLIC_SERVER_URL: "https://explicit.example.com/",
        SERVER_PUBLIC_URL: "https://server.example.com"
      }),
      {
        source: "EXPO_PUBLIC_SERVER_URL",
        url: "https://explicit.example.com"
      }
    );
  });

  it("uses the server public URL when the Expo URL is unset", () => {
    assert.deepEqual(
      resolveExpoServerUrl({
        SERVER_PUBLIC_URL: "https://api.example.com/"
      }),
      {
        source: "SERVER_PUBLIC_URL",
        url: "https://api.example.com"
      }
    );
  });

  it("converts a server public domain into an HTTPS URL", () => {
    assert.deepEqual(
      resolveExpoServerUrl({
        SERVER_PUBLIC_DOMAIN: "api.example.com"
      }),
      {
        source: "SERVER_PUBLIC_DOMAIN",
        url: "https://api.example.com"
      }
    );
  });

  it("falls back to the local development server", () => {
    assert.deepEqual(resolveExpoServerUrl({}), {
      source: "default",
      url: "http://localhost:3000"
    });
  });
});

describe("normalizeServerUrl", () => {
  it("uses HTTP for bare localhost addresses", () => {
    assert.equal(normalizeServerUrl("localhost:3000/"), "http://localhost:3000");
  });
});
