import fs from "fs";
import path from "path";

interface EasConfig {
  build?: Record<string, unknown>;
}

export function getEasProfiles(): string[] {
  const easJsonPath = path.join(process.cwd(), "eas.json");

  if (!fs.existsSync(easJsonPath)) {
    throw new Error("eas.json not found. Run 'eas build:configure' to create one.");
  }

  let easConfig: EasConfig;
  try {
    easConfig = JSON.parse(fs.readFileSync(easJsonPath, "utf-8"));
  } catch (error) {
    throw new Error(`Failed to parse eas.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!easConfig.build || typeof easConfig.build !== "object") {
    throw new Error("No build profiles found in eas.json");
  }

  const profiles = Object.keys(easConfig.build);
  if (profiles.length === 0) {
    throw new Error("No build profiles found in eas.json");
  }

  return profiles;
}
