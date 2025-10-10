import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';

describe('Manifest Route', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await env.DB.prepare('DELETE FROM updates').run();
    await env.DB.prepare('DELETE FROM apps').run();

    // Seed test app
    await env.DB.prepare(
      'INSERT INTO apps (id, name, api_key) VALUES (?, ?, ?)'
    ).bind('test-app', 'Test App', 'test-key').run();
  });

  it('should return 404 without expo-app-id header', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe('');
  });

  it('should return 404 without expo-runtime-version header', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-platform': 'ios',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe('');
  });

  it('should return 404 with invalid platform', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'invalid',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe('');
  });

  it('should return 204 when no updates exist (protocol version 0)', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(204);
  });

  it('should return noUpdateAvailable directive when no updates exist (protocol version 1)', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-protocol-version': '1',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('noUpdateAvailable');
  });

  it('should return manifest when update exists', async () => {
    // Insert a test update
    const updateId = 'test-update-123';
    const createdAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      updateId,
      'test-app',
      'production',
      '1.0.0',
      'ios',
      createdAt,
      'bundle-key',
      'bundle-hash',
      '.bundle',
      'application/javascript',
      'https://example.com/bundle.js',
      '[]'
    ).run();

    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-protocol-version': '1',
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('manifest');
    expect(text).toContain(updateId);
    expect(text).toContain('bundle-key');
  });

  it('should return noUpdateAvailable when client has current update', async () => {
    // Insert a test update
    const updateId = 'test-update-123';
    const createdAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO updates (
        id, app_id, channel, runtime_version, platform, created_at,
        launch_asset_key, launch_asset_hash, launch_asset_file_extension,
        launch_asset_content_type, launch_asset_url, assets_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      updateId,
      'test-app',
      'production',
      '1.0.0',
      'ios',
      createdAt,
      'bundle-key',
      'bundle-hash',
      '.bundle',
      'application/javascript',
      'https://example.com/bundle.js',
      '[]'
    ).run();

    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-protocol-version': '1',
        'expo-current-update-id': updateId,
        'expo-channel-name': 'production',
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('noUpdateAvailable');
  });

  it('should return 404 when expo-channel-name is not provided', async () => {
    const request = new Request('http://localhost/manifest', {
      headers: {
        'expo-app-id': 'test-app',
        'expo-runtime-version': '1.0.0',
        'expo-platform': 'ios',
        'expo-protocol-version': '1',
        // No expo-channel-name header
      },
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe('');
  });
});
