import { Context } from "hono";
import * as v from "valibot";
import { computeFileHash } from "../utils/crypto";
import {
  getAppByApiKey,
  getLatestUpdate,
  saveUpdate,
  cleanupOldUpdates,
  IUpdateMetadata,
} from "../utils/db";
import { UpdateCache } from "../utils/cache";
import { R2Storage } from "../utils/storage";
import { IEnv } from "../index";
import { Platform } from "../enums/platform";

const uploadFormFieldsSchema = v.object({
  channel: v.pipe(v.string(), v.minLength(1)),
  runtimeVersion: v.pipe(v.string(), v.minLength(1)),
  platform: v.picklist([Platform.IOS, Platform.ANDROID]),
  commitHash: v.optional(v.string()),
  fingerprint: v.optional(v.string()),
  ignoreFingerprintCheck: v.pipe(
    v.optional(v.picklist(["true", "false"])),
    v.transform((val) => val === "true"),
  ),
  expoConfig: v.pipe(
    v.optional(v.string()),
    v.transform((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }),
  ),
  metadata: v.pipe(
    v.optional(v.string()),
    v.transform((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }),
  ),
});

/**
 * Handles the upload request.
 *
 * @param context The request context.
 * @returns A Response object.
 */
export async function uploadHandler(
  context: Context<{ Bindings: IEnv }>,
): Promise<Response> {
  try {
    const allowedIPs = context.env.ALLOWED_UPLOAD_IPS;
    const isIPWhitelistEnabled = allowedIPs && allowedIPs.trim() !== "";

    if (isIPWhitelistEnabled) {
      const clientIP = context.req.header("cf-connecting-ip");
      const allowedList = allowedIPs
        .split(",")
        .map((ip) => ip.trim())
        .filter((ip) => ip !== "");

      // Check if client IP matches any allowed IP
      // For IPv6, check prefix (first 4 segments) for now... since suffix changes frequently
      const isIPAllowed = allowedList.some((allowedIP) => {
        if (clientIP === allowedIP) return true;

        // IPv6 prefix matching (e.g., 2a02:c7c:86f8:c000:: matches 2a02:c7c:86f8:c000:*)
        if (clientIP?.includes(":") && allowedIP.includes(":")) {
          const clientPrefix = clientIP.split(":").slice(0, 4).join(":");
          const allowedPrefix = allowedIP.split(":").slice(0, 4).join(":");
          return clientPrefix === allowedPrefix;
        }

        return false;
      });

      console.log("IP Whitelist Check:");
      console.log("  Client IP:", clientIP);
      console.log("  Allowed IPs:", allowedList);
      console.log("  Is allowed:", isIPAllowed);

      if (!clientIP || !isIPAllowed) {
        console.log(
          `❌ Blocked upload attempt from IP: ${clientIP || "unknown"}`,
        );
        return new Response("Access denied", { status: 401 });
      }
      console.log("✅ IP check passed");
    }

    // Validate API key
    const apiKey = context.req.header("x-ota-api-key");

    if (!apiKey) {
      console.log("❌ Missing API key");
      return new Response("Access denied", { status: 401 });
    }

    const db = context.env.DB;
    const app = await getAppByApiKey(db, apiKey);

    if (!app) {
      console.log("❌ Invalid API key");
      return new Response("Access denied", { status: 401 });
    }

    const formData = await context.req.formData();

    const fields: Record<string, string[]> = {};
    const files: Array<{
      fieldName: string;
      filename: string;
      contentType: string;
      data: ArrayBuffer;
    }> = [];

    for (const [key, value] of formData.entries()) {
      // @ts-ignore - undici types override Cloudflare's FormData, resolving value to string instead of string | File
      if (value instanceof File) {
        const buffer = await value.arrayBuffer();
        files.push({
          fieldName: key,
          filename: value.name,
          contentType: value.type || "application/octet-stream",
          data: buffer,
        });
        console.log(
          `FormData file: field="${key}" filename="${value.name}" type="${value.type}"`,
        );
      } else {
        if (!fields[key]) {
          fields[key] = [];
        }
        fields[key].push(value as string);
      }
    }

    const fieldValidation = v.safeParse(uploadFormFieldsSchema, {
      channel: fields["channel"]?.[0],
      runtimeVersion: fields["runtimeVersion"]?.[0],
      platform: fields["platform"]?.[0],
      commitHash: fields["commitHash"]?.[0],
      fingerprint: fields["fingerprint"]?.[0],
      ignoreFingerprintCheck: fields["ignoreFingerprintCheck"]?.[0],
      expoConfig: fields["expoConfig"]?.[0],
      metadata: fields["metadata"]?.[0],
    });

    if (!fieldValidation.success) {
      console.log(
        "❌ Invalid form fields:",
        fieldValidation.issues[0]?.message,
      );
      return new Response("Bad request", { status: 400 });
    }

    const {
      channel,
      runtimeVersion,
      platform,
      commitHash,
      fingerprint,
      ignoreFingerprintCheck,
      expoConfig,
      metadata,
    } = fieldValidation.output;
    const appId = app.id;

    // Validate fingerprint against latest existing update
    if (fingerprint) {
      const latestUpdate = await getLatestUpdate(
        db,
        appId,
        channel,
        runtimeVersion,
        platform,
      );
      const isFingerprintMismatched =
        latestUpdate?.fingerprint && latestUpdate.fingerprint !== fingerprint;
      const isFingerprintCheckIgnored = ignoreFingerprintCheck;

      if (isFingerprintMismatched && !isFingerprintCheckIgnored) {
        console.log(
          `❌ Fingerprint mismatch: expected ${latestUpdate.fingerprint}, got ${fingerprint}`,
        );
        return context.json({ error: "Fingerprint mismatch" }, 409);
      }

      if (isFingerprintMismatched) {
        console.log(
          `⚠️ Fingerprint mismatch ignored: expected ${latestUpdate.fingerprint}, got ${fingerprint}`,
        );
      }
    }

    // Extract asset metadata from parsed metadata
    let assetMetadata = null;
    if (metadata) {
      assetMetadata = metadata.fileMetadata?.[platform]?.assets || [];
    }

    const updateId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const bundleFile = files.find(
      (file) =>
        file.fieldName === "bundle" || file.filename?.endsWith(".bundle"),
    );
    const assetFiles = files.filter(
      (file) =>
        file.fieldName === "assets" || file.fieldName.startsWith("asset-"),
    );

    if (!bundleFile) {
      console.log("❌ Missing bundle file");
      return new Response("Bad request", { status: 400 });
    }

    if (!context.env.BUCKET_URL) {
      return context.json({ error: "BUCKET_URL is not configured" }, 500);
    }

    const storage = new R2Storage(context.env.BUCKET, context.env.BUCKET_URL);

    const [bundleHash, bundleKey] = await Promise.all([
      computeFileHash(bundleFile.data, "base64"),
      computeFileHash(bundleFile.data, "hex"),
    ]);

    // Get bundle file extension from filename, fallback to .hbc for Hermes bytecode
    let bundleExt = ".hbc";
    if (bundleFile.filename) {
      const dotIndex = bundleFile.filename.lastIndexOf(".");
      if (dotIndex !== -1) {
        bundleExt = bundleFile.filename.substring(dotIndex);
      } else {
        console.log(
          "⚠️ No extension found in bundle filename, using fallback .hbc",
        );
      }
    } else {
      console.log("⚠️ No bundle filename provided, using fallback .hbc");
    }

    const bundleUrl = await storage.uploadFile(
      `${appId}/${channel}/${runtimeVersion}/${updateId}/bundle${bundleExt}`,
      bundleFile.data,
    );

    const assets = await Promise.all(
      assetFiles.map(async (asset, index) => {
        const filename = asset.filename || `asset-${index}`;
        const [hash, key, url] = await Promise.all([
          computeFileHash(asset.data, "base64"),
          computeFileHash(asset.data, "hex"),
          storage.uploadFile(
            `${appId}/${channel}/${runtimeVersion}/${updateId}/${filename}`,
            asset.data,
          ),
        ]);

        // Get file extension from metadata if available
        let ext = "";

        // Try metadata first
        const assetMeta = assetMetadata?.find(
          (asset: { path: string; ext?: string }) =>
            asset.path === `assets/${filename}`,
        );
        if (assetMeta?.ext) {
          ext = "." + assetMeta.ext;
        }

        // Fallback to filename extension if not found in metadata
        if (!ext) {
          const dotIndex = filename.lastIndexOf(".");
          if (dotIndex !== -1) {
            ext = filename.substring(dotIndex);
          }
        }

        return {
          key,
          hash,
          fileExtension: ext,
          contentType: storage.getContentType(ext),
          url,
        };
      }),
    );

    const updateMetadata: IUpdateMetadata = {
      id: updateId,
      createdAt,
      runtimeVersion,
      channel,
      platform,
      launchAsset: {
        key: bundleKey,
        hash: bundleHash,
        fileExtension: bundleExt,
        contentType: storage.getContentType(bundleExt),
        url: bundleUrl,
      },
      assets,
      commitHash,
      expoConfigJson: expoConfig
        ? JSON.stringify({
            name: expoConfig.name,
            slug: expoConfig.slug,
            version: expoConfig.version,
            scheme: expoConfig.scheme,
            orientation: expoConfig.orientation,
            platforms: expoConfig.platforms,
            userInterfaceStyle: expoConfig.userInterfaceStyle,
            runtimeVersion: expoConfig.runtimeVersion,
            updates: expoConfig.updates,
            extra: expoConfig.extra,
            ...(expoConfig.ios && {
              ios: {
                bundleIdentifier: expoConfig.ios.bundleIdentifier,
                supportsTablet: expoConfig.ios.supportsTablet,
                appStoreUrl: expoConfig.ios.appStoreUrl,
              },
            }),
            ...(expoConfig.android && {
              android: {
                package: expoConfig.android.package,
                playStoreUrl: expoConfig.android.playStoreUrl,
              },
            }),
          })
        : undefined,
      fingerprint,
    };

    await Promise.all([
      saveUpdate(db, appId, updateMetadata),
      UpdateCache.invalidate(context.env.CACHE, {
        appId,
        channel,
        runtimeVersion,
        platform,
      }),
    ]);

    // Cleanup old updates if configured
    const maxUpdatesToKeep = Number(context.env.MAX_UPDATES_TO_KEEP) || 0;
    if (maxUpdatesToKeep > 0) {
      context.executionCtx.waitUntil(
        cleanupOldUpdates(
          db,
          appId,
          channel,
          runtimeVersion,
          platform,
          maxUpdatesToKeep,
        )
          .then(async (deletedIds) => {
            if (deletedIds.length === 0) return;
            console.log(`Cleaning up ${deletedIds.length} old updates`);
            await Promise.all(
              deletedIds.map((id) =>
                storage.deleteFolder(
                  `${appId}/${channel}/${runtimeVersion}/${id}`,
                ),
              ),
            );
          })
          .catch((err) => console.error("Cleanup failed:", err)),
      );
    }

    console.log(
      `✅ Update uploaded successfully: ${updateId} (${platform}, ${channel}, ${runtimeVersion})`,
    );
    return context.json({ success: true });
  } catch (error) {
    console.error("❌ Error processing upload:", error);
    return new Response("Server error", { status: 500 });
  }
}
