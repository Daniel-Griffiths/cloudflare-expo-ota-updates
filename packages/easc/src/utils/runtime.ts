/**
 * Utilities for handling Expo runtime versions
 */

import { PlatformType } from "../enums/platform";

export interface IAppJson {
  expo: {
    runtimeVersion?: string | { policy: string };
    version?: string;
    platforms?: string[];
  };
}

/**
 * Resolve the runtime version from app.json
 * Supports both string values and policy objects
 */
export function resolveRuntimeVersion(appJson: IAppJson): string {
  const runtimeVersionConfig = appJson.expo.runtimeVersion;

  // If it's a string, use it directly
  if (typeof runtimeVersionConfig === "string") {
    return runtimeVersionConfig;
  }

  // If it's an object with policy: appVersion
  if (
    typeof runtimeVersionConfig === "object" &&
    runtimeVersionConfig?.policy === "appVersion"
  ) {
    const version = appJson.expo.version;
    if (!version) {
      throw new Error(
        'runtimeVersion policy is "appVersion" but no version field found in app.json'
      );
    }
    return version;
  }

  throw new Error(
    "Invalid runtimeVersion configuration in app.json. Must be either:\n" +
      '  - A string: "runtimeVersion": "1.0.0"\n' +
      '  - Policy object: "runtimeVersion": { "policy": "appVersion" }'
  );
}

/**
 * Get platforms from app.json, defaulting to both iOS and Android
 */
export function getPlatforms(appJson: IAppJson): PlatformType[] {
  const platforms = appJson.expo.platforms || ["ios", "android"];
  return platforms.filter(p => p === "ios" || p === "android") as PlatformType[];
}