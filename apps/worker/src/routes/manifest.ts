import { Context } from "hono";
import * as v from "valibot";
import { getLatestUpdate, type IUpdateMetadata } from "../utils/db";
import { getSignature } from "../utils/codesigning";
import { UpdateCache } from "../utils/cache";
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

const manifestHeadersSchema = v.object({
  "expo-app-id": v.pipe(v.string(), v.minLength(1)),
  "expo-runtime-version": v.pipe(v.string(), v.minLength(1)),
  "expo-platform": v.picklist([Platform.IOS, Platform.ANDROID]),
  "expo-channel-name": v.pipe(v.string(), v.minLength(1)),
  "expo-current-update-id": v.optional(v.string()),
  "expo-protocol-version": v.pipe(
    v.optional(v.string(), "0"),
    v.transform((val) => parseInt(val, 10)),
  ),
});

/**
 * Serializes content, optionally signs it, and sends it as a multipart response.
 * Signing and serialization happen in the same place to guarantee the signed
 * bytes are identical to the response body.
 */
async function sendMultipartResponse(
  context: Context<{ Bindings: IEnv }>,
  content: IUpdateManifest | INoUpdateAvailableDirective,
  fieldName: "manifest" | "directive",
  protocolVersion: number,
): Promise<Response> {
  const boundary = "ExpoUpdateBoundary";
  const jsonBody = JSON.stringify(content);

  const expectSignature = context.req.header("expo-expect-signature");
  const signature =
    expectSignature && context.env.CODE_SIGNING_PRIVATE_KEY
      ? await getSignature(context.env.CODE_SIGNING_PRIVATE_KEY, jsonBody)
      : null;

  const partHeaders = [
    `Content-Disposition: form-data; name="${fieldName}"`,
    `Content-Type: application/json`,
    ...(signature ? [`expo-signature: ${signature}`] : []),
  ];

  const body = [`--${boundary}`, ...partHeaders, "", jsonBody, `--${boundary}--`, ""].join("\r\n");

  return new Response(body, {
    headers: {
      "expo-protocol-version": protocolVersion.toString(),
      "expo-sfv-version": "0",
      "expo-manifest-filters": "",
      "expo-server-defined-headers": "",
      "cache-control": "private, max-age=0",
      "content-type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}

/**
 * Sends a "no update available" response.
 */
async function sendNoUpdateAvailable(
  context: Context<{ Bindings: IEnv }>,
  protocolVersion: number,
): Promise<Response> {
  if (protocolVersion < 1) {
    return new Response(null, { status: 404 });
  }

  return sendMultipartResponse(
    context,
    { type: "noUpdateAvailable" },
    "directive",
    protocolVersion,
  );
}

/**
 * Resolves the expoClient config from the database.
 */
function resolveExpoConfig(expoConfigJson?: string): Record<string, unknown> {
  if (!expoConfigJson) {
    return {};
  }

  try {
    return JSON.parse(expoConfigJson);
  } catch (error) {
    console.error("Failed to parse expoConfigJson from database:", error);
    return {};
  }
}

/**
 * Handles the manifest request.
 */
export async function manifestHandler(context: Context<{ Bindings: IEnv }>): Promise<Response> {
  try {
    const headerValidation = v.safeParse(manifestHeadersSchema, {
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
    } = headerValidation.output;

    const db = context.env.DB;
    const kv = context.env.CACHE;

    const cached = await UpdateCache.get<IUpdateMetadata>(kv, { appId, channel, runtimeVersion, platform });
    const latestUpdate = cached ?? await getLatestUpdate(db, appId, channel, runtimeVersion, platform);

    if (!cached && latestUpdate) {
      context.executionCtx.waitUntil(
        UpdateCache.set(kv, { appId, channel, runtimeVersion, platform, data: latestUpdate }),
      );
    }

    if (!latestUpdate) {
      return await sendNoUpdateAvailable(context, protocolVersion);
    }

    if (currentUpdateId && currentUpdateId === latestUpdate.id) {
      return await sendNoUpdateAvailable(context, protocolVersion);
    }

    const expoClient = resolveExpoConfig(latestUpdate.expoConfigJson);

    context.executionCtx.waitUntil(
      db
        .prepare(
          "UPDATE updates SET download_count = download_count + 1, last_downloaded_at = ? WHERE id = ?",
        )
        .bind(new Date().toISOString(), latestUpdate.id)
        .run(),
    );

    const manifest: IUpdateManifest = {
      id: latestUpdate.id,
      createdAt: latestUpdate.createdAt,
      runtimeVersion: latestUpdate.runtimeVersion,
      launchAsset: latestUpdate.launchAsset,
      assets: latestUpdate.assets,
      metadata: { channel },
      extra: { expoClient, channel },
    };

    return sendMultipartResponse(context, manifest, "manifest", protocolVersion);
  } catch (error) {
    console.error("Error serving manifest:", error);
    return new Response(null, { status: 500 });
  }
}
