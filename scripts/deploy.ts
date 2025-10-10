#!/usr/bin/env node --experimental-strip-types --env-file=.env
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const APP_DIR = process.cwd();
const DIST_DIR = path.join(APP_DIR, "dist");
const OTA_SERVER = process.env.OTA_SERVER;
const OTA_API_KEY = process.env.OTA_API_KEY;

/**
 * Resolve the runtime version from app.json
 *
 * @param appJson - Parsed app.json content
 * @returns Resolved runtime version string
 */
function resolveRuntimeVersion(appJson: {
  expo: {
    runtimeVersion?: string | { policy: string };
    version?: string;
  };
}): string {
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
 * Uploads the JavaScript bundle and assets for a specific platform.
 *
 * @param platform - The target platform (iOS or Android).
 * @param channel - The release channel (e.g., "production", "staging").
 * @param runtimeVersion - The runtime version of the app.
 * @param commitHash - The commit hash of the code being deployed (optional).
 */
async function uploadBundle(
  platform: "ios" | "android",
  channel: string,
  runtimeVersion: string,
  commitHash?: string
) {
  const appJsonPath = path.join(APP_DIR, "app.json");
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  const expoConfig = appJson.expo;

  const metadataPath = path.join(DIST_DIR, "metadata.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  const form = new FormData();
  form.append("channel", channel);
  form.append("runtimeVersion", runtimeVersion);
  form.append("platform", platform);
  form.append("expoConfig", JSON.stringify(expoConfig));
  form.append("metadata", JSON.stringify(metadata));
  if (commitHash) {
    form.append("commitHash", commitHash);
  }

  const bundlePath = path.join(DIST_DIR, `_expo/static/js/${platform}`);
  const bundleFiles = fs
    .readdirSync(bundlePath)
    .filter((f) => f.startsWith("entry-") && f.endsWith(".hbc"));

  if (bundleFiles.length === 0) {
    throw new Error(`No bundle found for ${platform}`);
  }

  const bundleFile = path.join(bundlePath, bundleFiles[0]);
  const bundleBuffer = fs.readFileSync(bundleFile);
  const bundleBlob = new Blob([bundleBuffer]);
  const bundleFileName = bundleFiles[0]; // e.g., "entry-xxx.hbc"
  form.append("bundle", bundleBlob, bundleFileName);

  const assetsPath = path.join(DIST_DIR, "assets");
  const platformAssets = metadata.fileMetadata?.[platform]?.assets || [];

  if (fs.existsSync(assetsPath) && platformAssets.length > 0) {
    const platformAssetFiles = new Set(
      platformAssets.map((asset: { path: string }) => path.basename(asset.path))
    );

    const assetFiles = fs.readdirSync(assetsPath);
    let assetIndex = 0;

    assetFiles.forEach((assetFile) => {
      const assetPath = path.join(assetsPath, assetFile);
      // Only upload if it's in the platform's asset list
      if (
        fs.statSync(assetPath).isFile() &&
        platformAssetFiles.has(assetFile)
      ) {
        const assetBuffer = fs.readFileSync(assetPath);
        const assetBlob = new Blob([assetBuffer]);
        form.append(`asset-${assetIndex}`, assetBlob, assetFile);
        assetIndex++;
      }
    });
  }

  const url = new URL("/upload", OTA_SERVER);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-ota-api-key": OTA_API_KEY!,
    },
    body: form,
  });

  if (response.ok) {
    console.log(`   ✓ ${platform} uploaded`);
  } else {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }
}

(async () => {
  if (!OTA_SERVER) {
    console.error("❌ Error: OTA_SERVER environment variable is required");
    console.log("   Set it in your .env file or export it:");
    console.log('   export OTA_SERVER="https://your-ota-server.com"');
    process.exit(1);
  }

  if (!OTA_API_KEY) {
    console.error("❌ Error: OTA_API_KEY environment variable is required");
    console.log("   Set it in your .env file or export it:");
    console.log('   export OTA_API_KEY="your-api-key"');
    process.exit(1);
  }

  if (!process.argv.includes("--channel")) {
    console.error("❌ Error: --channel flag is required");
    console.log("   Specify which channel to deploy to:");
    console.log("   yarn deploy --channel production");
    console.log("   yarn deploy --channel staging");
    process.exit(1);
  }

  const channel = process.argv[process.argv.indexOf("--channel") + 1];

  if (!channel) {
    console.error("❌ Error: --channel flag requires a value");
    console.log("   Example: yarn deploy --channel production");
    process.exit(1);
  }

  console.log("📦 Building app bundles...");

  execSync("npx expo export", {
    cwd: APP_DIR,
    stdio: "inherit",
  });

  // Read the expo config to get appId
  const appJsonPath = path.join(APP_DIR, "app.json");
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));

  // Resolve runtime version
  const runtimeVersion = resolveRuntimeVersion(appJson);

  // Capture git commit hash (optional)
  let commitHash: string | undefined;
  try {
    commitHash = execSync("git rev-parse HEAD", {
      cwd: APP_DIR,
      encoding: "utf-8",
    }).trim();
  } catch (error) {
    console.warn("   ⚠️  Could not determine git commit hash");
  }

  console.log(`\n📤 Uploading to OTA server...`);
  console.log(`   Server: ${OTA_SERVER}`);
  console.log(`   Channel: ${channel}`);
  console.log(`   Runtime: ${runtimeVersion}`);
  if (commitHash) {
    console.log(`   Commit: ${commitHash.substring(0, 7)}`);
  }

  // Get platforms from app.json
  const platforms = (appJson.expo.platforms || ["ios", "android"]) as (
    | "ios"
    | "android"
  )[];

  // Upload bundles for specified platforms
  for (const platform of platforms) {
    if (platform === "ios" || platform === "android") {
      await uploadBundle(platform, channel, runtimeVersion, commitHash);
    }
  }

  console.log("\n✅ Updates published successfully!");
})();
