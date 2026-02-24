import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { IAppJson } from "./runtime";
import { Platform, PlatformType } from "../enums/platform";

const require = createRequire(import.meta.url);

const BUNDLE_EXTENSIONS = [".hbc", ".js", ".bundle"];
const BUNDLE_PREFIXES = ["entry-", "index-"];
const APP_CONFIGS = [
  { filename: "app.config.ts", loader: _loadJsConfig },
  { filename: "app.config.js", loader: _loadJsConfig },
  { filename: "app.json", loader: _loadJsonConfig },
] as const;

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

  for (const { filename, loader } of APP_CONFIGS) {
    const filePath = path.join(resolvedDir, filename);
    if (fs.existsSync(filePath)) {
      return _parseAppConfig(filePath, filename, loader);
    }
  }

  const names = APP_CONFIGS.map((config) => config.filename).join(", ");
  throw new Error(`No app config found in ${appDir}. Create ${names}`);
}

/**
 * Read and parse metadata.json from the export directory
 */
export function readMetadata(exportDir: string): IMetadata {
  const metadataPath = path.join(exportDir, "metadata.json");

  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `metadata.json not found in ${exportDir}. Did you run 'expo export'?`,
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

/**
 * Find the bundle file for a platform
 */
export function findBundleFile(
  exportDir: string,
  platform: PlatformType,
): string {
  const bundlePath = path.join(exportDir, `_expo/static/js/${platform}`);

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle directory not found: ${bundlePath}`);
  }

  const firstBundle = fs
    .readdirSync(bundlePath)
    .filter((f) => _isBundleFilename(f))
    .sort()
    .at(0);

  if (!firstBundle) {
    throw new Error(
      `No bundle found for ${platform} in ${bundlePath}. ` +
        `Expected files like entry-*.hbc, entry-*.js, entry-*.bundle, index-*.hbc, index-*.js, index-*.bundle. Run 'npx expo export' first.`,
    );
  }

  return path.join(bundlePath, firstBundle);
}

/**
 * Get asset files for a platform
 */
export function getAssetFiles(
  exportDir: string,
  metadata: IMetadata,
  platform: PlatformType,
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
    platformAssets.map((asset) => path.basename(asset.path)),
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
  appDir: string = process.cwd(),
): string {
  // If exportDir is relative, resolve it from appDir
  const resolvedExportDir = path.isAbsolute(exportDir)
    ? exportDir
    : path.join(appDir, exportDir);

  if (!fs.existsSync(resolvedExportDir)) {
    throw new Error(
      `Export directory not found: ${resolvedExportDir}\n` +
        `Run 'npx expo export' or use --export-dir to specify a different directory.`,
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
          `Run 'npx expo export' to generate a valid export.`,
      );
    }
  }

  return resolvedExportDir;
}

/**
 * Type guard that checks whether a value conforms to the IAppJson shape
 */
function _isAppJson(value: unknown): value is IAppJson {
  if (typeof value !== "object" || value === null || !("expo" in value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record["expo"] === "object" && record["expo"] !== null;
}

/**
 * Load a JS/TS config file via require, resolving default exports
 */
function _loadJsConfig(filePath: string): unknown {
  const config = require(filePath);
  return config?.default ?? config;
}

/**
 * Load and parse a JSON config file from disk
 */
function _loadJsonConfig(filePath: string): unknown {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Load a config file using the given loader and validate it as IAppJson
 */
function _parseAppConfig(
  filePath: string,
  label: string,
  loader: (filePath: string) => unknown,
): IAppJson {
  try {
    const result = loader(filePath);
    if (!_isAppJson(result)) {
      throw new Error(`${label} must contain an object with an "expo" key`);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('"expo" key')) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load ${label}: ${msg}`, { cause: error });
  }
}

/**
 * Check if a filename matches a valid bundle pattern (prefix + extension)
 */
function _isBundleFilename(name: string): boolean {
  const hasValidPrefix = BUNDLE_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  );
  if (!hasValidPrefix) return false;
  return BUNDLE_EXTENSIONS.some((extension) => name.endsWith(extension));
}
