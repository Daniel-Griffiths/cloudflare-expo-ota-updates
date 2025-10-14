#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import chalk from "chalk";
import {
  parseArguments,
  getVersion,
  showCompatibilityNotices,
} from "./src/utils/cli";
import { validateConfig, getConfig } from "./src/utils/validation";
import { resolveRuntimeVersion, getPlatforms } from "./src/utils/runtime";
import { getCommitHash, getShortCommitHash, isGitClean } from "./src/utils/git";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
  checkExportDirectory,
} from "./src/utils/files";
import { uploadBundle, createDryRunSummary } from "./src/utils/upload";
import { Logger } from "./src/utils/logger";

async function main() {
  let logger: Logger;

  try {
    // Parse CLI arguments (EAS-compatible)
    const options = parseArguments();

    // Initialize logger with JSON mode if requested
    logger = new Logger(options.json);

    // Show version
    if (!options.json && !options.nonInteractive) {
      logger.section(`easc v${getVersion()}`);
      logger.info("EAS Deploy compatible tool for Cloudflare Workers");
    }

    // Show compatibility notices for EAS flags
    if (!options.json) {
      showCompatibilityNotices(options);
    }

    // Validate configuration
    const validation = validateConfig(options.channel);
    if (!validation.valid) {
      validation.errors.forEach((error) => logger.error(error));

      if (options.json) {
        logger.outputJson(
          "error",
          "Configuration validation failed",
          validation.errors
        );
      }
      process.exit(1);
    }

    const config = getConfig(options.channel!);

    // Check git status (warning only)
    if (!isGitClean() && !options.json) {
      logger.warn("Working directory has uncommitted changes");
    }

    // Build if needed
    if (!options.skipBuild) {
      logger.startSpinner("Building app bundles...");
      try {
        const exportCmd =
          options.exportDir !== "dist"
            ? `npx expo export --output-dir ${options.exportDir}`
            : "npx expo export";

        execSync(exportCmd, {
          cwd: process.cwd(),
          stdio: options.verbose ? "inherit" : "ignore",
        });
        logger.succeedSpinner("Build completed");
      } catch (error) {
        logger.failSpinner("Build failed");
        throw error;
      }
    } else {
      logger.info(
        `Skipping build (using existing export from ${options.exportDir})`
      );
    }

    // Check export directory
    const exportDir = checkExportDirectory(options.exportDir);

    // Read configuration files
    const appJson = readAppJson();
    const metadata = readMetadata(exportDir);

    // Get deployment info
    const runtimeVersion = resolveRuntimeVersion(appJson);
    const platforms = getPlatforms(appJson);
    const commitHash = getCommitHash();
    const shortCommit = getShortCommitHash();

    // Store data for JSON output
    if (options.json) {
      logger.addJsonData("channel", options.channel);
      logger.addJsonData("runtime_version", runtimeVersion);
      logger.addJsonData("platforms", platforms);
      if (shortCommit) {
        logger.addJsonData("commit", shortCommit);
      }
      if (options.alias) {
        logger.addJsonData("alias", options.alias);
      }
      if (options.id) {
        logger.addJsonData("deployment_id", options.id);
      }
    }

    // Display deployment info
    if (!options.json || options.verbose) {
      logger.section("📤 Deployment Info");
      logger.keyValue("Server", config.otaServer);
      logger.keyValue("Channel", options.channel!);
      logger.keyValue("Runtime", runtimeVersion);
      logger.keyValue("Export Dir", options.exportDir);
      if (shortCommit) {
        logger.keyValue("Commit", shortCommit);
      }
      if (options.alias) {
        logger.keyValue("Alias", options.alias);
      }
      if (options.id) {
        logger.keyValue("ID", options.id);
      }
      if (options.dryRun) {
        logger.keyValue("Mode", chalk.yellow("DRY RUN"));
      }
    }

    // Upload for each platform
    const results: any[] = [];

    for (const platform of platforms) {
      logger.section(
        `${platform === "ios" ? "🍎" : "🤖"} ${platform.toUpperCase()}`
      );

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
            alias: options.alias,
            id: options.id,
          });

          if (!options.json) {
            logger.box(summary);
          }
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
            alias: options.alias,
            id: options.id,
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
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Store results for JSON output
    if (options.json) {
      logger.addJsonData("results", results);
    }

    // Success
    if (options.json) {
      logger.outputJson(
        "success",
        options.dryRun
          ? "Dry run completed successfully"
          : "Updates published successfully"
      );
    } else {
      logger.section("");
      if (options.dryRun) {
        logger.success("Dry run completed successfully!");
        logger.info("Run without --dry-run to perform actual upload");
      } else {
        logger.success("✨ Updates published successfully!");
      }
    }
  } catch (error) {
    // Error handling
    if (!logger!) {
      logger = new Logger();
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (logger.constructor.prototype.hasOwnProperty("outputJson")) {
      const jsonLogger = logger as Logger;
      if ((logger as any).jsonMode) {
        jsonLogger.outputJson("error", "Deployment failed", [errorMessage]);
      } else {
        logger.section("");
        logger.error("Deployment failed:");
        console.error(chalk.red(errorMessage));
        if (process.env.DEBUG && error instanceof Error) {
          console.error(error.stack);
        }
      }
    } else {
      logger.section("");
      logger.error("Deployment failed:");
      console.error(chalk.red(errorMessage));
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
