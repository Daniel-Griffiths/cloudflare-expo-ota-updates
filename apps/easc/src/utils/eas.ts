import fs from "fs";
import path from "path";

interface EasConfig {
  build?: Record<string, unknown>;
}

/**
 * Get EAS build profiles from eas.json
 * Returns an empty array if eas.json is not found, invalid, or has no build profiles.
 * If `prioritize` is provided and exists in the profiles, it will be moved to the front.
 */
export function getEasProfiles(prioritize?: string): string[] {
  const easJsonPath = path.join(process.cwd(), "eas.json");

  if (!fs.existsSync(easJsonPath)) {
    return [];
  }

  let easConfig: EasConfig;
  try {
    easConfig = JSON.parse(fs.readFileSync(easJsonPath, "utf-8"));
  } catch {
    return [];
  }

  if (!easConfig.build || typeof easConfig.build !== "object") {
    return [];
  }

  const profiles = Object.keys(easConfig.build);

  if (prioritize && profiles.includes(prioritize)) {
    return [prioritize, ...profiles.filter((p) => p !== prioritize)];
  }

  return profiles;
}
