import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';

describe('Upload Route', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await env.DB.prepare('DELETE FROM updates').run();
    await env.DB.prepare('DELETE FROM apps').run();

    // Seed test app
    await env.DB.prepare(
      'INSERT INTO apps (id, name, api_key) VALUES (?, ?, ?)'
    ).bind('test-app', 'Test App', 'test-api-key-123').run();
  });

  it('should reject upload without API key', async () => {
    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toBe('Access denied');
  });

  it('should reject upload with invalid API key', async () => {
    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'invalid-key',
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toBe('Access denied');
  });

  it('should reject upload without runtime version', async () => {
    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('platform', 'ios');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe('Bad request');
  });

  it('should reject upload with invalid platform', async () => {
    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'invalid');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe('Bad request');
  });

  it('should reject upload without bundle file', async () => {
    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe('Bad request');
  });

  it('should successfully upload bundle', async () => {
    // Create a mock bundle file
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: 'application/javascript' });

    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');
    formData.append('bundle', bundleBlob, 'bundle.js');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
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
      'SELECT * FROM updates WHERE app_id = ? AND runtime_version = ? AND platform = ?'
    ).bind('test-app', '1.0.0', 'ios').first();

    expect(update).toBeTruthy();
    expect(update.channel).toBe('production');
  });

  it('should upload bundle with assets', async () => {
    // Create mock files
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: 'application/javascript' });

    const assetContent = 'fake-image-data';
    const assetBlob = new Blob([assetContent], { type: 'image/png' });

    const formData = new FormData();
    formData.append('channel', 'production');
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');
    formData.append('bundle', bundleBlob, 'bundle.js');
    formData.append('assets', assetBlob, 'icon.png');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
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
      'SELECT * FROM updates WHERE app_id = ? AND runtime_version = ? AND platform = ?'
    ).bind('test-app', '1.0.0', 'ios').first();

    expect(update).toBeTruthy();
    const assets = JSON.parse(update.assets_json);
    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBeGreaterThan(0);
  });

  it('should reject upload when channel is not specified', async () => {
    const bundleContent = 'console.log("test bundle");';
    const bundleBlob = new Blob([bundleContent], { type: 'application/javascript' });

    const formData = new FormData();
    // Not specifying channel
    formData.append('runtimeVersion', '1.0.0');
    formData.append('platform', 'ios');
    formData.append('bundle', bundleBlob, 'bundle.js');

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'x-ota-api-key': 'test-api-key-123',
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe('Bad request');
  });
});
