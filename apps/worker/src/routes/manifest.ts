import { Context } from "hono";
import { z } from "zod";
import { getLatestUpdate } from "../utils/db";
import { R2Storage } from "../utils/storage";
import { IEnv } from "../index";
import { Platform } from "../enums/platform";

export interface IUpdateManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
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
  metadata: Record<string, unknown>;
  extra: Record<string, unknown>;
}

export interface INoUpdateAvailableDirective {
  type: "noUpdateAvailable";
}

const manifestHeadersSchema = z.object({
  "expo-app-id": z.string().min(1, "expo-app-id is required"),
  "expo-runtime-version": z.string().min(1, "expo-runtime-version is required"),
  "expo-platform": z.enum([Platform.IOS, Platform.ANDROID]),
  "expo-channel-name": z.string().min(1, "expo-channel-name is required"),
  "expo-current-update-id": z.string().optional(),
  "expo-protocol-version": z
    .string()
    .optional()
    .default("0")
    .transform((v) => parseInt(v, 10)),
});

/**
 * Sends a multipart response.
 *
 * @param content The content to send.
 * @param fieldName The name of the field to send the content in.
 * @param protocolVersion The Expo protocol version.
 * @returns A Response object.
 */
function sendMultipartResponse(
  content: IUpdateManifest | INoUpdateAvailableDirective,
  fieldName: "manifest" | "directive",
  protocolVersion: number
): Response {
  const boundary = "ExpoUpdateBoundary";

  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${fieldName}"`,
    `Content-Type: application/json`,
    `content-type: application/json; charset=utf-8`,
    "",
    JSON.stringify(content),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "expo-protocol-version": protocolVersion.toString(),
      "expo-sfv-version": "0",
      "cache-control": "private, max-age=0",
      "content-type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}

/**
 * Sends a "no update available" response.
 *
 * @param context The request context.
 * @param protocolVersion The Expo protocol version.
 * @returns A Response object.
 */
function sendNoUpdateAvailable(
  _context: Context<{ Bindings: IEnv }>,
  protocolVersion: number
): Response {
  if (protocolVersion < 1) {
    return new Response(null, { status: 404 });
  }

  return sendMultipartResponse(
    {
      type: "noUpdateAvailable",
    },
    "directive",
    protocolVersion
  );
}

/**
 * Handles the manifest request.
 *
 * @param context The request context.
 * @returns A Response object.
 */
export async function manifestHandler(
  context: Context<{ Bindings: IEnv }>
): Promise<Response> {
  try {
    const headerValidation = manifestHeadersSchema.safeParse({
      "expo-app-id": context.req.header("expo-app-id"),
      "expo-runtime-version": context.req.header("expo-runtime-version"),
      "expo-platform": context.req.header("expo-platform"),
      "expo-channel-name": context.req.header("expo-channel-name"),
      "expo-current-update-id": context.req.header("expo-current-update-id"),
      "expo-protocol-version": context.req.header("expo-protocol-version"),
    });

    if (!headerValidation.success) {
      return new Response(null, { status: 404 });
    }

    const {
      "expo-app-id": appId,
      "expo-runtime-version": runtimeVersion,
      "expo-platform": platform,
      "expo-channel-name": channel,
      "expo-current-update-id": currentUpdateId,
      "expo-protocol-version": protocolVersion,
    } = headerValidation.data;

    const db = context.env.DB;
    const storage = new R2Storage(context.env.BUCKET, context.env.BUCKET_URL);

    const latestUpdate = await getLatestUpdate(
      db,
      appId,
      channel,
      runtimeVersion,
      platform
    );

    if (!latestUpdate) {
      return sendNoUpdateAvailable(context, protocolVersion);
    }

    if (currentUpdateId && currentUpdateId === latestUpdate.id) {
      return sendNoUpdateAvailable(context, protocolVersion);
    }

    // Try to get expoConfig from database first (new updates)
    // Fall back to R2 storage for older updates or if DB parse fails
    // TODO: remove this in a few months
    let expoClient = {};
    let dbParseFailed = false;

    if (latestUpdate.expoConfigJson) {
      // New path: Get from database (fast!)
      try {
        expoClient = JSON.parse(latestUpdate.expoConfigJson);
      } catch (error) {
        console.error("Failed to parse expoConfigJson from database:", error);
        dbParseFailed = true;
      }
    }

    // Fallback to R2 storage if DB doesn't have it or parsing failed
    if (!latestUpdate.expoConfigJson || dbParseFailed) {
      try {
        const expoConfigPath = `${appId}/${channel}/${runtimeVersion}/${latestUpdate.id}/expoConfig.json`;
        const expoConfigBuffer = await storage.downloadFile(expoConfigPath);
        if (expoConfigBuffer) {
          const decoder = new TextDecoder();
          expoClient = JSON.parse(decoder.decode(expoConfigBuffer));
        }
      } catch (error) {
        // Continue without config
      }
    }

    context.executionCtx.waitUntil(
      db
        .prepare(
          "UPDATE updates SET download_count = download_count + 1, last_downloaded_at = ? WHERE id = ?"
        )
        .bind(new Date().toISOString(), latestUpdate.id)
        .run()
    );

    const manifest: IUpdateManifest = {
      id: latestUpdate.id,
      createdAt: latestUpdate.createdAt,
      runtimeVersion: latestUpdate.runtimeVersion,
      launchAsset: latestUpdate.launchAsset,
      assets: latestUpdate.assets,
      metadata: { channel },
      extra: {
        expoClient,
        channel,
      },
    };

    return sendMultipartResponse(manifest, "manifest", protocolVersion);
  } catch (error) {
    console.error("Error serving manifest:", error);
    return new Response(null, { status: 500 });
  }
}
