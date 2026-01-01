import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, inArray } from "drizzle-orm";
import { apps, updates, type IApp } from "../db/schema";
import { Platform } from "../enums/platform";

/**
 * Application-level metadata for OTA updates
 *
 * This interface represents the complete update metadata used throughout the application.
 * It differs from the database row structure by providing a more ergonomic format
 * with nested objects for assets.
 */
export interface IUpdateMetadata {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  channel: string;
  platform: Platform;
  launchAsset: {
    key: string;
    hash: string;
    fileExtension: string;
    contentType: string;
    url: string;
  };
  assets: Array<{
    key: string;
    hash: string;
    fileExtension: string;
    contentType: string;
    url: string;
  }>;
  commitHash?: string | undefined;
  expoConfigJson?: string | undefined;
}

/**
 * Retrieves an app from the database by its API key
 *
 * @param d1 - Cloudflare D1 database instance
 * @param apiKey - API key to search for
 * @returns App record if found, null otherwise
 */
export async function getAppByApiKey(
  d1: D1Database,
  apiKey: string
): Promise<IApp | null> {
  const db = drizzle(d1);
  const result = await db
    .select()
    .from(apps)
    .where(eq(apps.apiKey, apiKey))
    .limit(1);

  return result[0] || null;
}

/**
 * Saves an OTA update to the database
 *
 * @param d1 - Cloudflare D1 database instance
 * @param appId - ID of the app this update belongs to
 * @param metadata - Complete update metadata including assets and launch asset
 */
export async function saveUpdate(
  d1: D1Database,
  appId: string,
  metadata: IUpdateMetadata
): Promise<void> {
  const db = drizzle(d1);
  await db.insert(updates).values({
    id: metadata.id,
    appId,
    channel: metadata.channel,
    runtimeVersion: metadata.runtimeVersion,
    platform: metadata.platform,
    createdAt: metadata.createdAt,
    launchAssetKey: metadata.launchAsset.key,
    launchAssetHash: metadata.launchAsset.hash,
    launchAssetFileExtension: metadata.launchAsset.fileExtension,
    launchAssetContentType: metadata.launchAsset.contentType,
    launchAssetUrl: metadata.launchAsset.url,
    assetsJson: JSON.stringify(metadata.assets),
    commitHash: metadata.commitHash || null,
    expoConfigJson: metadata.expoConfigJson || null,
  });
}

/**
 * Retrieves the most recent update for a specific app, channel, runtime, and platform
 *
 * @param d1 - Cloudflare D1 database instance
 * @param appId - ID of the app
 * @param channel - Channel name (e.g., "production", "staging")
 * @param runtimeVersion - Runtime version string
 * @param platform - Target platform (ios or android)
 * @returns Latest update metadata if found, null otherwise
 */
export async function getLatestUpdate(
  d1: D1Database,
  appId: string,
  channel: string,
  runtimeVersion: string,
  platform: string
): Promise<IUpdateMetadata | null> {
  const db = drizzle(d1);
  const result = await db
    .select()
    .from(updates)
    .where(
      and(
        eq(updates.appId, appId),
        eq(updates.channel, channel),
        eq(updates.runtimeVersion, runtimeVersion),
        eq(updates.platform, platform)
      )
    )
    .orderBy(desc(updates.createdAt))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  const assets = JSON.parse(row.assetsJson);

  return {
    id: row.id,
    createdAt: row.createdAt,
    runtimeVersion: row.runtimeVersion,
    channel: row.channel,
    platform: row.platform as Platform,
    launchAsset: {
      key: row.launchAssetKey,
      hash: row.launchAssetHash,
      fileExtension: row.launchAssetFileExtension,
      contentType: row.launchAssetContentType,
      url: row.launchAssetUrl,
    },
    assets,
    commitHash: row.commitHash || undefined,
    expoConfigJson: row.expoConfigJson || undefined,
  };
}

/**
 * Deletes old updates for a specific app/channel/runtime/platform combination
 *
 * Keeps only the most recent N updates (specified by keepCount) and deletes the rest.
 * Updates are ordered by creation date, with newest updates being preserved.
 *
 * @param d1 - Cloudflare D1 database instance
 * @param appId - ID of the app
 * @param channel - Channel name
 * @param runtimeVersion - Runtime version string
 * @param platform - Target platform (ios or android)
 * @param keepCount - Number of recent updates to preserve
 * @returns Array of deleted update IDs
 */
export async function cleanupOldUpdates(
  d1: D1Database,
  appId: string,
  channel: string,
  runtimeVersion: string,
  platform: string,
  keepCount: number
): Promise<string[]> {
  const db = drizzle(d1);

  const rows = await db
    .select({ id: updates.id })
    .from(updates)
    .where(
      and(
        eq(updates.appId, appId),
        eq(updates.channel, channel),
        eq(updates.runtimeVersion, runtimeVersion),
        eq(updates.platform, platform)
      )
    )
    .orderBy(desc(updates.createdAt));

  if (rows.length <= keepCount) {
    return [];
  }

  // Get IDs to delete (all except the most recent keepCount)
  const idsToDelete = rows.slice(keepCount).map((row) => row.id);

  if (idsToDelete.length === 0) {
    return [];
  }

  await db.delete(updates).where(inArray(updates.id, idsToDelete));

  return idsToDelete;
}
