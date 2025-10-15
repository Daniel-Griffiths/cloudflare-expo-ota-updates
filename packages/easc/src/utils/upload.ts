import fs from "fs";
import { IAppJson } from "./runtime";
import { IMetadata } from "./files";
import { Config } from "./schema";
import { PlatformType } from "../enums/platform";

export interface IUploadOptions {
  platform: PlatformType;
  channel: string;
  runtimeVersion: string;
  commitHash?: string;
  bundlePath: string;
  assetPaths: string[];
  expoConfig: IAppJson["expo"];
  metadata: IMetadata;
  config: Config;
}

/**
 * Upload a bundle and assets for a platform
 */
export async function uploadBundle(options: IUploadOptions): Promise<void> {
  const {
    platform,
    channel,
    runtimeVersion,
    commitHash,
    bundlePath,
    assetPaths,
    expoConfig,
    metadata,
    config,
  } = options;

  const form = new FormData();
  form.append("channel", channel);
  form.append("runtimeVersion", runtimeVersion);
  form.append("platform", platform);
  form.append("expoConfig", JSON.stringify(expoConfig));
  form.append("metadata", JSON.stringify(metadata));

  if (commitHash) {
    form.append("commitHash", commitHash);
  }

  // Add bundle
  const bundleBuffer = fs.readFileSync(bundlePath);
  const bundleBlob = new Blob([bundleBuffer]);
  const bundleFileName = bundlePath.split("/").pop()!;
  form.append("bundle", bundleBlob, bundleFileName);

  // Add assets
  assetPaths.forEach((assetPath, index) => {
    const assetBuffer = fs.readFileSync(assetPath);
    const assetBlob = new Blob([assetBuffer]);
    const assetFileName = assetPath.split("/").pop()!;
    form.append(`asset-${index}`, assetBlob, assetFileName);
  });

  // Upload
  const url = new URL("/upload", config.otaServer);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-ota-api-key": config.apiKey,
    },
    body: form,
  });

  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch (e) {
      errorText = "Unable to read error response";
    }
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }
}

/**
 * Create a dry run summary
 */
export function createDryRunSummary(options: {
  platform: PlatformType;
  bundlePath: string;
  assetPaths: string[];
  channel: string;
  runtimeVersion: string;
  commitHash?: string;
}): string {
  const {
    platform,
    bundlePath,
    assetPaths,
    channel,
    runtimeVersion,
    commitHash,
  } = options;

  const bundleSize = fs.statSync(bundlePath).size;
  const totalAssetSize = assetPaths.reduce((sum, path) => {
    return sum + fs.statSync(path).size;
  }, 0);

  const lines = [
    `Platform: ${platform}`,
    `Channel: ${channel}`,
    `Runtime Version: ${runtimeVersion}`,
  ];

  if (commitHash) {
    lines.push(`Commit: ${commitHash}`);
  }

  lines.push(
    `Bundle: ${formatBytes(bundleSize)}`,
    `Assets: ${assetPaths.length} files (${formatBytes(totalAssetSize)})`
  );

  return lines.join("\n");
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}
