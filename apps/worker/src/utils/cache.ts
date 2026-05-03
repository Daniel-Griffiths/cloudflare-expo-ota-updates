interface UpdateCacheKey {
  appId: string;
  channel: string;
  runtimeVersion: string;
  platform: string;
}

export class UpdateCache {
  private static readonly TTL_SECONDS = 60;

  static async get<T>({
    appId,
    channel,
    runtimeVersion,
    platform,
  }: UpdateCacheKey): Promise<T | null> {
    const res = await caches.default.match(
      this._key({ appId, channel, runtimeVersion, platform }),
    );
    if (!res) return null;
    return res.json() as Promise<T>;
  }

  static async set(params: UpdateCacheKey & { data: unknown }): Promise<void> {
    const { data, ...key } = params;
    await caches.default.put(
      this._key(key),
      new Response(JSON.stringify(data), {
        headers: { "Cache-Control": `max-age=${this.TTL_SECONDS}` },
      }),
    );
  }

  static async invalidate(params: UpdateCacheKey): Promise<void> {
    await caches.default.delete(this._key(params));
  }

  private static _key({
    appId,
    channel,
    runtimeVersion,
    platform,
  }: UpdateCacheKey): Request {
    return new Request(
      `https://cache.internal/manifest/${appId}/${channel}/${runtimeVersion}/${platform}`,
    );
  }
}
