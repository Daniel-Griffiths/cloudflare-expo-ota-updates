import { Context } from "hono";
import { z } from "zod";
import { computeFileHash } from "../utils/crypto";
import {
  getAppByApiKey,
  saveUpdate,
  cleanupOldUpdates,
  IUpdateMetadata,
} from "../utils/db";
import { R2Storage } from "../utils/storage";
import { IEnv } from "../index";
import { Platform } from "../enums/platform";

const uploadFormFieldsSchema = z.object({
  channel: z.string().min(1, "channel is required"),
  runtimeVersion: z.string().min(1, "runtimeVersion is required"),
  platform: z.enum([Platform.IOS, Platform.ANDROID]),
  commitHash: z.string().optional(),
  expoConfig: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }),
  metadata: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }),
});

/**
 * Handles the upload request.
 *
 * @param context The request context.
 * @returns A Response object.
 */
export async function uploadHandler(
  context: Context<{ Bindings: IEnv }>
): Promise<Response> {
  try {
    const allowedIPs = context.env.ALLOWED_UPLOAD_IPS;
    const hasIPWhitelist = allowedIPs && allowedIPs.trim() !== "";

    if (hasIPWhitelist) {
      const clientIP = context.req.header("cf-connecting-ip");
      const allowedList = allowedIPs
        .split(",")
        .map((ip) => ip.trim())
        .filter((ip) => ip !== "");

      // Check if client IP matches any allowed IP
      // For IPv6, check prefix (first 4 segments) for now... since suffix changes frequently
      const isAllowed = allowedList.some((allowedIP) => {
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
      console.log("  Is allowed:", isAllowed);

      if (!clientIP || !isAllowed) {
        console.log(
          `❌ Blocked upload attempt from IP: ${clientIP || "unknown"}`
        );
        return new Response(null, { status: 404 });
      }
      console.log("✅ IP check passed");
    }

    // Validate API key
    const apiKey = context.req.header("x-ota-api-key");

    if (!apiKey) {
      console.log("❌ Missing API key");
      return new Response(null, { status: 404 });
    }

    const db = context.env.DB;
    const app = await getAppByApiKey(db, apiKey);

    if (!app) {
      console.log("❌ Invalid API key");
      return new Response(null, { status: 404 });
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
      // @ts-ignore - oh no
      if (value instanceof File) {
        // It's a file
        const buffer = await value.arrayBuffer();
        files.push({
          fieldName: key,
          filename: value.name,
          contentType: value.type || "application/octet-stream",
          data: buffer,
        });
        console.log(
          `FormData file: field="${key}" filename="${value.name}" type="${value.type}"`
        );
      } else {
        // It's a text field
        if (!fields[key]) {
          fields[key] = [];
        }
        fields[key].push(value as string);
      }
    }

    const fieldValidation = uploadFormFieldsSchema.safeParse({
      channel: fields["channel"]?.[0],
      runtimeVersion: fields["runtimeVersion"]?.[0],
      platform: fields["platform"]?.[0],
      commitHash: fields["commitHash"]?.[0],
      expoConfig: fields["expoConfig"]?.[0],
      metadata: fields["metadata"]?.[0],
    });

    if (!fieldValidation.success) {
      console.log(
        "❌ Invalid form fields:",
        fieldValidation.error.issues[0]?.message
      );
      return new Response(null, { status: 404 });
    }

    const {
      channel,
      runtimeVersion,
      platform,
      commitHash,
      expoConfig,
      metadata,
    } = fieldValidation.data;
    const appId = app.id;

    // Extract asset metadata from parsed metadata
    let assetMetadata = null;
    if (metadata) {
      assetMetadata = metadata.fileMetadata?.[platform]?.assets || [];
    }

    const updateId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const bundleFile = files.find(
      (file) =>
        file.fieldName === "bundle" || file.filename?.endsWith(".bundle")
    );
    const assetFiles = files.filter(
      (file) =>
        file.fieldName === "assets" || file.fieldName.startsWith("asset-")
    );

    if (!bundleFile) {
      console.log("❌ Missing bundle file");
      return new Response(null, { status: 404 });
    }

    const storage = new R2Storage(context.env.BUCKET, context.env.BUCKET_URL);

    const bundleHash = await computeFileHash(bundleFile.data, "base64");
    const bundleKey = await computeFileHash(bundleFile.data, "hex");

    // Get bundle file extension from filename, fallback to .hbc for Hermes bytecode
    let bundleExt = ".hbc";
    if (bundleFile.filename) {
      const dotIndex = bundleFile.filename.lastIndexOf(".");
      if (dotIndex !== -1) {
        bundleExt = bundleFile.filename.substring(dotIndex);
      } else {
        console.log(
          "⚠️ No extension found in bundle filename, using fallback .hbc"
        );
      }
    } else {
      console.log("⚠️ No bundle filename provided, using fallback .hbc");
    }

    const bundleUrl = await storage.uploadFile(
      `${appId}/${channel}/${runtimeVersion}/${updateId}/bundle${bundleExt}`,
      bundleFile.data
    );

    const assets = await Promise.all(
      assetFiles.map(async (asset, index) => {
        const filename = asset.filename || `asset-${index}`;
        const hash = await computeFileHash(asset.data, "base64");
        const key = await computeFileHash(asset.data, "hex");
        const url = await storage.uploadFile(
          `${appId}/${channel}/${runtimeVersion}/${updateId}/${filename}`,
          asset.data
        );

        // Get file extension from metadata if available
        let ext = "";

        // Try metadata first
        const assetMeta = assetMetadata?.find(
          (asset: { path: string; ext?: string }) =>
            asset.path === `assets/${filename}`
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
      })
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
    };

    if (expoConfig) {
      const encoder = new TextEncoder();
      const configBuffer = encoder.encode(JSON.stringify(expoConfig, null, 2));
      await storage.uploadFile(
        `${appId}/${channel}/${runtimeVersion}/${updateId}/expoConfig.json`,
        configBuffer as unknown as ArrayBuffer
      );
    }

    await saveUpdate(db, appId, updateMetadata);

    // Cleanup old updates if configured
    const maxUpdatesToKeep = context.env.MAX_UPDATES_TO_KEEP || 0;
    if (maxUpdatesToKeep <= 0) {
      console.log(
        `✅ Update uploaded successfully: ${updateId} (${platform}, ${channel}, ${runtimeVersion})`
      );
      return context.json({ success: true });
    }

    const deletedIds = await cleanupOldUpdates(
      db,
      appId,
      channel,
      runtimeVersion,
      platform,
      maxUpdatesToKeep
    );

    // Delete R2 files for old updates
    if (deletedIds.length > 0) {
      console.log(`Cleaning up ${deletedIds.length} old updates`);
      await Promise.all(
        deletedIds.map((id) =>
          storage.deleteFolder(`${appId}/${channel}/${runtimeVersion}/${id}`)
        )
      );
    }

    console.log(
      `✅ Update uploaded successfully: ${updateId} (${platform}, ${channel}, ${runtimeVersion})`
    );
    return context.json({ success: true });
  } catch (error) {
    console.error("❌ Error processing upload:", error);
    return new Response(null, { status: 500 });
  }
}
