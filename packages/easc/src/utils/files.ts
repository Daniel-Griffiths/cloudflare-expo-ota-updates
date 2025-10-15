import fs from "fs";
import path from "path";
import { IAppJson } from "./runtime";
import { Platform, PlatformType } from "../enums/platform";

export interface IMetadata {
  fileMetadata?: {
    [Platform.iOS]?: {
      assets: Array<{ path: string }>;
    };
    [Platform.Android]?: {
      assets: Array<{ path: string }>;
    };
  };
}

/**
 * Read and parse app.json file
 */
export function readAppJson(appDir: string = process.cwd()): IAppJson {
  const appJsonPath = path.join(appDir, "app.json");

  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`app.json not found in ${appDir}`);
  }

  try {
    const content = fs.readFileSync(appJsonPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse app.json: ${error}`);
  }
}

/**
 * Read and parse metadata.json from the export directory
 */
export function readMetadata(exportDir: string): IMetadata {
  const metadataPath = path.join(exportDir, "metadata.json");

  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `metadata.json not found in ${exportDir}. Did you run 'expo export'?`
    );
  }

  try {
    const content = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse metadata.json: ${error}`);
  }
}

/**
 * Find the bundle file for a platform
 */
export function findBundleFile(
  exportDir: string,
  platform: PlatformType
): string {
  const bundlePath = path.join(exportDir, `_expo/static/js/${platform}`);

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle directory not found: ${bundlePath}`);
  }

  const bundleFiles = fs
    .readdirSync(bundlePath)
    .filter((f) => f.startsWith("entry-") && f.endsWith(".hbc"));

  if (bundleFiles.length === 0) {
    throw new Error(`No bundle found for ${platform}`);
  }

  return path.join(bundlePath, bundleFiles[0]);
}

/**
 * Get asset files for a platform
 */
export function getAssetFiles(
  exportDir: string,
  metadata: IMetadata,
  platform: PlatformType
): string[] {
  const assetsPath = path.join(exportDir, "assets");

  if (!fs.existsSync(assetsPath)) {
    return [];
  }

  const platformMetadata =
    platform === Platform.iOS
      ? metadata.fileMetadata?.[Platform.iOS]
      : metadata.fileMetadata?.[Platform.Android];
  const platformAssets = platformMetadata?.assets || [];

  if (platformAssets.length === 0) {
    return [];
  }

  const platformAssetFiles = new Set(
    platformAssets.map((asset) => path.basename(asset.path))
  );

  const assetFiles = fs.readdirSync(assetsPath);
  const validAssets: string[] = [];

  assetFiles.forEach((assetFile) => {
    const assetPath = path.join(assetsPath, assetFile);
    if (fs.statSync(assetPath).isFile() && platformAssetFiles.has(assetFile)) {
      validAssets.push(assetPath);
    }
  });

  return validAssets;
}

/**
 * Check if the export directory exists and has been built
 * Supports custom export directories (EAS-compatible)
 */
export function checkExportDirectory(
  exportDir: string,
  appDir: string = process.cwd()
): string {
  // If exportDir is relative, resolve it from appDir
  const resolvedExportDir = path.isAbsolute(exportDir)
    ? exportDir
    : path.join(appDir, exportDir);

  if (!fs.existsSync(resolvedExportDir)) {
    throw new Error(
      `Export directory not found: ${resolvedExportDir}\n` +
        `Run 'npx expo export' or use --export-dir to specify a different directory.`
    );
  }

  // Check for expected structure
  const expectedPaths = [
    path.join(resolvedExportDir, "metadata.json"),
    path.join(resolvedExportDir, "_expo"),
  ];

  for (const expectedPath of expectedPaths) {
    if (!fs.existsSync(expectedPath)) {
      throw new Error(
        `Invalid export directory structure in: ${resolvedExportDir}\n` +
          `Run 'npx expo export' to generate a valid export.`
      );
    }
  }

  return resolvedExportDir;
}

/**
 * Legacy wrapper for backwards compatibility
 * @deprecated Use checkExportDirectory instead
 */
export function checkDistDirectory(appDir: string = process.cwd()): string {
  return checkExportDirectory("dist", appDir);
}
