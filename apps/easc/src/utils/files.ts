import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { IAppJson } from "./runtime";
import { Platform, PlatformType } from "../enums/platform";

const require = createRequire(import.meta.url);

function loadAppConfigFile(filePath: string, label: string): IAppJson {
  try {
    const config = require(filePath);
    return (config?.default ?? config) as IAppJson;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load ${label}: ${msg}`, { cause: error });
  }
}

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
 * Read app config from the app directory.
 * Tries in order: app.config.js, app.config.ts, app.json.
 * Returns the first found; throws if none exist.
 */
export function readAppJson(appDir: string = process.cwd()): IAppJson {
  const resolvedDir = path.resolve(appDir);
  const appConfigJsPath = path.join(resolvedDir, "app.config.js");
  const appConfigTsPath = path.join(resolvedDir, "app.config.ts");
  const appJsonPath = path.join(resolvedDir, "app.json");

  if (fs.existsSync(appConfigJsPath)) {
    return loadAppConfigFile(appConfigJsPath, "app.config.js");
  }

  if (fs.existsSync(appConfigTsPath)) {
    return loadAppConfigFile(appConfigTsPath, "app.config.ts");
  }

  if (fs.existsSync(appJsonPath)) {
    try {
      const content = fs.readFileSync(appJsonPath, "utf-8");
      return JSON.parse(content) as IAppJson;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse app.json: ${msg}`, { cause: error });
    }
  }

  throw new Error(
    `No app config found in ${appDir}. Create app.config.js, app.config.ts or app.json`
  );
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
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse metadata.json: ${msg}`, { cause: error });
  }
}

const BUNDLE_EXTENSIONS = [".hbc", ".js", ".bundle"];
const BUNDLE_PREFIXES = ["entry-", "index-"];

function isBundleFilename(name: string): boolean {
  const hasValidPrefix = BUNDLE_PREFIXES.some((p) => name.startsWith(p));
  if (!hasValidPrefix) return false;
  return BUNDLE_EXTENSIONS.some((ext) => name.endsWith(ext));
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
    .filter((f) => isBundleFilename(f));

  if (bundleFiles.length === 0) {
    throw new Error(
      `No bundle found for ${platform} in ${bundlePath}. ` +
        `Expected files like entry-*.hbc, index-*.hbc or *.js. Run 'npx expo export' first.`
    );
  }

  const [firstBundle] = [...bundleFiles].sort();
  if (!firstBundle) {
    throw new Error(`No bundle found for ${platform}`);
  }

  return path.join(bundlePath, firstBundle);
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
