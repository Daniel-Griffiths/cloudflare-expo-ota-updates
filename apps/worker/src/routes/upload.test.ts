import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";

describe("Upload Route", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await env.DB.prepare("DELETE FROM updates").run();
    await env.DB.prepare("DELETE FROM apps").run();

    // Seed test app
    await env.DB.prepare("INSERT INTO apps (id, name, api_key) VALUES (?, ?, ?)")
      .bind("test-app", "Test App", "test-api-key-123")
      .run();
  });

  it("should reject upload without API key", async () => {
    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toBe("Access denied");
  });

  it("should reject upload with invalid API key", async () => {
    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "invalid-key",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toBe("Access denied");
  });

  it("should reject upload without runtime version", async () => {
    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("platform", "ios");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe("Bad request");
  });

  it("should reject upload with invalid platform", async () => {
    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "invalid");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe("Bad request");
  });

  it("should reject upload without bundle file", async () => {
    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe("Bad request");
  });

  it("should successfully upload bundle", async () => {
    // Create a mock bundle file
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");
    formData.append("bundle", bundleBlob, "bundle.js");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true });

    // Verify update was saved to database
    const update = await env.DB.prepare(
      "SELECT * FROM updates WHERE app_id = ? AND runtime_version = ? AND platform = ?",
    )
      .bind("test-app", "1.0.0", "ios")
      .first();

    expect(update).toBeTruthy();
    expect(update!["channel"]).toBe("production");
  });

  it("should upload bundle with assets", async () => {
    // Create mock files
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    const assetContent = "fake-image-data";
    const assetBlob = new Blob([assetContent], { type: "image/png" });

    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");
    formData.append("bundle", bundleBlob, "bundle.js");
    formData.append("assets", assetBlob, "icon.png");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true });

    // Verify update has assets in database
    const update = await env.DB.prepare(
      "SELECT * FROM updates WHERE app_id = ? AND runtime_version = ? AND platform = ?",
    )
      .bind("test-app", "1.0.0", "ios")
      .first();

    expect(update).toBeTruthy();
    const assets = JSON.parse(update!["assets_json"] as string);
    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBeGreaterThan(0);
  });

  it("should store fingerprint when provided", async () => {
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    const formData = new FormData();
    formData.append("channel", "production");
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");
    formData.append("fingerprint", "abc123hash");
    formData.append("bundle", bundleBlob, "bundle.js");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);

    const update = await env.DB.prepare(
      "SELECT * FROM updates WHERE app_id = ? AND runtime_version = ? AND platform = ?",
    )
      .bind("test-app", "1.0.0", "ios")
      .first();

    expect(update).toBeTruthy();
    expect(update!["fingerprint"]).toBe("abc123hash");
  });

  it("should reject upload when fingerprint mismatches existing update", async () => {
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    // First upload with fingerprint
    const formData1 = new FormData();
    formData1.append("channel", "production");
    formData1.append("runtimeVersion", "1.0.0");
    formData1.append("platform", "ios");
    formData1.append("fingerprint", "original-fingerprint");
    formData1.append("bundle", bundleBlob, "bundle.js");

    const req1 = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "x-ota-api-key": "test-api-key-123" },
      body: formData1,
    });

    const ctx1 = createExecutionContext();
    const res1 = await app.fetch(req1, env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);

    // Second upload with different fingerprint — should be rejected
    const formData2 = new FormData();
    formData2.append("channel", "production");
    formData2.append("runtimeVersion", "1.0.0");
    formData2.append("platform", "ios");
    formData2.append("fingerprint", "different-fingerprint");
    formData2.append("bundle", bundleBlob, "bundle.js");

    const req2 = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "x-ota-api-key": "test-api-key-123" },
      body: formData2,
    });

    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(req2, env, ctx2);
    await waitOnExecutionContext(ctx2);

    expect(res2.status).toBe(409);
    const json = (await res2.json()) as { error: string };
    expect(json.error).toBe("Fingerprint mismatch");
  });

  it("should allow mismatched fingerprint when ignoreFingerprintCheck is set", async () => {
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    // First upload
    const formData1 = new FormData();
    formData1.append("channel", "production");
    formData1.append("runtimeVersion", "1.0.0");
    formData1.append("platform", "ios");
    formData1.append("fingerprint", "original-fingerprint");
    formData1.append("bundle", bundleBlob, "bundle.js");

    const req1 = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "x-ota-api-key": "test-api-key-123" },
      body: formData1,
    });

    const ctx1 = createExecutionContext();
    await app.fetch(req1, env, ctx1);
    await waitOnExecutionContext(ctx1);

    // Second upload with different fingerprint but ignore flag set
    const formData2 = new FormData();
    formData2.append("channel", "production");
    formData2.append("runtimeVersion", "1.0.0");
    formData2.append("platform", "ios");
    formData2.append("fingerprint", "different-fingerprint");
    formData2.append("ignoreFingerprintCheck", "true");
    formData2.append("bundle", bundleBlob, "bundle.js");

    const req2 = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "x-ota-api-key": "test-api-key-123" },
      body: formData2,
    });

    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(req2, env, ctx2);
    await waitOnExecutionContext(ctx2);

    expect(res2.status).toBe(200);
  });

  it("should reject upload when channel is not specified", async () => {
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: "application/javascript" });

    const formData = new FormData();
    // Not specifying channel
    formData.append("runtimeVersion", "1.0.0");
    formData.append("platform", "ios");
    formData.append("bundle", bundleBlob, "bundle.js");

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        "x-ota-api-key": "test-api-key-123",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe("Bad request");
  });
});
