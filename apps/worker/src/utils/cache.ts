interface UpdateCacheKey {
  appId: string;
  channel: string;
  runtimeVersion: string;
  platform: string;
}

export class UpdateCache {
  private static readonly TTL_SECONDS = 86400; // 24 hours — invalidated globally on upload

  static async get<T>(kv: KVNamespace | undefined, params: UpdateCacheKey): Promise<T | null> {
    return kv?.get<T>(this._key(params), "json") ?? null;
  }

  static async set(
    kv: KVNamespace | undefined,
    params: UpdateCacheKey & { data: unknown },
  ): Promise<void> {
    const { data, ...key } = params;
    await kv?.put(this._key(key), JSON.stringify(data), { expirationTtl: this.TTL_SECONDS });
  }

  static async invalidate(kv: KVNamespace | undefined, params: UpdateCacheKey): Promise<void> {
    await kv?.delete(this._key(params));
  }

  private static _key({ appId, channel, runtimeVersion, platform }: UpdateCacheKey): string {
    return `manifest:${appId}:${channel}:${runtimeVersion}:${platform}`;
  }
}
