#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import chalk from "chalk";
import { parseArguments } from "./src/utils/cli.ts";
import { validateConfig, getConfig } from "./src/utils/schema.ts";
import { resolveRuntimeVersion, getPlatforms } from "./src/utils/runtime.ts";
import { getCommitHash, getShortCommitHash, isGitClean } from "./src/utils/git.ts";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
  checkExportDirectory,
} from "./src/utils/files.ts";
import { uploadBundle, createDryRunSummary } from "./src/utils/upload.ts";
import { Logger } from "./src/utils/logger.ts";
import { PlatformType } from "./src/enums/platform.ts";

type IDeploymentResult = {
  platform: PlatformType;
  status: "dry_run" | "uploaded" | "failed";
  bundle_size: number;
  asset_count: number;
  error?: string;
};

(async () => {
  let logger: Logger;

  try {
    const options = parseArguments();

    logger = new Logger();

    const validation = validateConfig(options.channel);
    if (!validation.valid) {
      validation.errors.forEach((error) => logger.error(error));
      process.exit(1);
    }

    const config = getConfig(options.channel!);

    if (!isGitClean()) {
      logger.warn("Working directory has uncommitted changes");
    }

    // Build if needed
    if (!options.skipBuild) {
      logger.startSpinner("Building app bundles...");

      execSync(
        options.exportDir !== "dist"
          ? `npx expo export --output-dir ${options.exportDir}`
          : "npx expo export",
        {
          cwd: process.cwd(),
          stdio: "ignore",
        }
      );

      logger.succeedSpinner("Build completed");
    } else {
      logger.info(
        `Skipping build (using existing export from ${options.exportDir})`
      );
    }

    const exportDir = checkExportDirectory(options.exportDir);
    const appJson = readAppJson();
    const metadata = readMetadata(exportDir);
    const runtimeVersion = resolveRuntimeVersion(appJson);
    const platforms = getPlatforms(appJson);
    const commitHash = getCommitHash();
    const shortCommit = getShortCommitHash();

    logger.section("📤 Deployment Info");
    logger.table([
      ["Server", config.otaServer],
      ["Runtime", runtimeVersion],
      ["Commit", shortCommit || ""],
      ["Export Dir", options.exportDir],
      ["Channel", options.channel || ""],
    ]);

    const results: IDeploymentResult[] = [];

    for (const platform of platforms) {
      logger.section(platform.toUpperCase());

      try {
        // Find bundle and assets
        const bundlePath = findBundleFile(exportDir, platform);
        const assetPaths = getAssetFiles(exportDir, metadata, platform);

        if (options.dryRun) {
          // Dry run - just show what would be uploaded
          const summary = createDryRunSummary({
            platform,
            bundlePath,
            assetPaths,
            channel: options.channel!,
            runtimeVersion,
            commitHash,
          });

          logger.box(summary);
          logger.success(`${platform} (dry run)`);

          results.push({
            platform,
            status: "dry_run",
            bundle_size: fs.statSync(bundlePath).size,
            asset_count: assetPaths.length,
          });
        } else {
          // Actual upload
          logger.startSpinner(`Uploading ${platform}...`);

          await uploadBundle({
            platform,
            channel: options.channel!,
            runtimeVersion,
            commitHash,
            bundlePath,
            assetPaths,
            expoConfig: appJson.expo,
            metadata,
            config,
          });

          logger.succeedSpinner(`${platform} uploaded`);

          results.push({
            platform,
            status: "uploaded",
            bundle_size: fs.statSync(bundlePath).size,
            asset_count: assetPaths.length,
          });
        }
      } catch (error) {
        logger.failSpinner(`${platform} failed`);
        results.push({
          platform,
          status: "failed",
          bundle_size: 0,
          asset_count: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    logger.section("");
    if (options.dryRun) {
      logger.success("Dry run completed successfully!");
      logger.info("Run without --dry-run to perform actual upload");
    } else {
      logger.success("✨ Updates published successfully!");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Deployment Failed: ${errorMessage}`));
    process.exit(1);
  }
})();
