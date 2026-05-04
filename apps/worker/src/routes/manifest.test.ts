import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { UpdateCache } from "../utils/cache";

describe("Manifest Route", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await env.DB.prepare("DELETE FROM updates").run();
    await env.DB.prepare("DELETE FROM apps").run();

    // Clear cache
    await UpdateCache.invalidate(env.CACHE, {
      appId: "test-app",
      channel: "production",
      runtimeVersion: "1.0.0",
      platform: "ios",
    });

    // Seed test app
    await env.DB.prepare("INSERT INTO apps (id, name, api_key) VALUES (?, ?, ?)")
      .bind("test-app", "Test App", "test-key")
      .run();
  });

  it("should return 404 without expo-app-id header", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("should return 404 without expo-runtime-version header", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-platform": "ios",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("should return 404 with invalid platform", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "invalid",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("should return 204 when no updates exist (protocol version 0)", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });

  it("should return noUpdateAvailable directive when no updates exist (protocol version 1)", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("noUpdateAvailable");
  });

  it("should return manifest when update exists", async () => {
    // Insert a test update
    const updateId = "test-update-123";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        updateId,
        "test-app",
        "production",
        "1.0.0",
        "ios",
        createdAt,
        "bundle-key",
        "bundle-hash",
        ".bundle",
        "application/javascript",
        "https://example.com/bundle.js",
        "[]",
      )
      .run();

    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("manifest");
    expect(text).toContain(updateId);
    expect(text).toContain("bundle-key");
  });

  it("should return noUpdateAvailable when client has current update", async () => {
    // Insert a test update
    const updateId = "test-update-123";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        updateId,
        "test-app",
        "production",
        "1.0.0",
        "ios",
        createdAt,
        "bundle-key",
        "bundle-hash",
        ".bundle",
        "application/javascript",
        "https://example.com/bundle.js",
        "[]",
      )
      .run();

    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        "expo-current-update-id": updateId,
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("noUpdateAvailable");
  });

  it("should not include expo-signature when no private key is configured", async () => {
    const updateId = "test-update-no-sig";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        updateId,
        "test-app",
        "production",
        "1.0.0",
        "ios",
        createdAt,
        "bundle-key",
        "bundle-hash",
        ".bundle",
        "application/javascript",
        "https://example.com/bundle.js",
        "[]",
      )
      .run();

    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        "expo-channel-name": "production",
        "expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("expo-signature");
  });

  it("should not include expo-signature when expo-expect-signature header is absent", async () => {
    const updateId = "test-update-no-expect";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        updateId,
        "test-app",
        "production",
        "1.0.0",
        "ios",
        createdAt,
        "bundle-key",
        "bundle-hash",
        ".bundle",
        "application/javascript",
        "https://example.com/bundle.js",
        "[]",
      )
      .run();

    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        "expo-channel-name": "production",
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("expo-signature");
  });

  it("should return 404 when expo-channel-name is not provided", async () => {
    const request = new Request("http://localhost/manifest", {
      headers: {
        "expo-app-id": "test-app",
        "expo-runtime-version": "1.0.0",
        "expo-platform": "ios",
        "expo-protocol-version": "1",
        // No expo-channel-name header
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("should serve cached manifest on second request", async () => {
    const updateId = "test-update-cache";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        updateId, "test-app", "production", "1.0.0", "ios", createdAt,
        "bundle-key", "bundle-hash", ".bundle",
        "application/javascript", "https://example.com/bundle.js", "[]",
      )
      .run();

    const headers = {
      "expo-app-id": "test-app",
      "expo-runtime-version": "1.0.0",
      "expo-platform": "ios",
      "expo-protocol-version": "1",
      "expo-channel-name": "production",
    };

    // First request — populates cache
    const ctx1 = createExecutionContext();
    const res1 = await app.fetch(new Request("http://localhost/manifest", { headers }), env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);
    const text1 = await res1.text();
    expect(text1).toContain(updateId);

    // Delete from DB — only cache should serve it now
    await env.DB.prepare("DELETE FROM updates").run();

    // Second request — should still return the update from cache
    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(new Request("http://localhost/manifest", { headers }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(200);
    const text2 = await res2.text();
    expect(text2).toContain(updateId);
  });

  it("should return fresh data after cache invalidation", async () => {
    const headers = {
      "expo-app-id": "test-app",
      "expo-runtime-version": "1.0.0",
      "expo-platform": "ios",
      "expo-protocol-version": "1",
      "expo-channel-name": "production",
    };

    // Insert first update and make a request to populate cache
    await env.DB.prepare(
      `INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "update-v1", "test-app", "production", "1.0.0", "ios", new Date().toISOString(),
        "bundle-v1", "hash-v1", ".bundle",
        "application/javascript", "https://example.com/v1.js", "[]",
      )
      .run();

    const ctx1 = createExecutionContext();
    const res1 = await app.fetch(new Request("http://localhost/manifest", { headers }), env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(await res1.text()).toContain("update-v1");

    // Invalidate cache and insert a new update
    await UpdateCache.invalidate(env.CACHE, {
      appId: "test-app",
      channel: "production",
      runtimeVersion: "1.0.0",
      platform: "ios",
    });

    await env.DB.prepare("DELETE FROM updates").run();
    await env.DB.prepare(
      `INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "update-v2", "test-app", "production", "1.0.0", "ios", new Date().toISOString(),
        "bundle-v2", "hash-v2", ".bundle",
        "application/javascript", "https://example.com/v2.js", "[]",
      )
      .run();

    // Should return the new update, not the cached old one
    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(new Request("http://localhost/manifest", { headers }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(await res2.text()).toContain("update-v2");
  });
});
