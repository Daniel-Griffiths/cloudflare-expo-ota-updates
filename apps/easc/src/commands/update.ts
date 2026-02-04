import fs from "fs";
import type { CommandModule } from "yargs";
import { validateConfig, getConfig } from "../utils/schema";
import { resolveRuntimeVersion, getPlatforms } from "../utils/runtime";
import { getCommitHash, getShortCommitHash, isGitClean } from "../utils/git";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
  checkExportDirectory,
} from "../utils/files";
import { uploadBundle, createDryRunSummary } from "../utils/upload";
import { Logger } from "../utils/logger";
import { PlatformType } from "../enums/platform";
import { runx } from "../utils/runx";

interface IArgs {
  channel: string;
  skipBuild: boolean;
  dryRun: boolean;
  exportDir: string;
  nonInteractive: boolean;
}

export const update: CommandModule = {
  command: "update",
  describe: "Deploy an OTA update to the specified channel",
  builder: (yargs) =>
    yargs
      .option("channel", {
        alias: "c",
        type: "string",
        choices: ["production", "staging", "dev"],
        description: "Deployment channel",
      })
      .option("skip-build", {
        type: "boolean",
        description: "Skip running 'expo export' (use existing build)",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        description: "Outputs deployment info instead of uploading",
        default: false,
      })
      .option("export-dir", {
        type: "string",
        description: "Directory where the Expo project was exported",
        default: "dist",
      })
      .option("non-interactive", {
        type: "boolean",
        description: "Never prompt for user input",
        default: false,
      })
      .example("$0 update --channel production", "Deploy to production")
      .example("$0 update -c staging --skip-build", "Deploy existing build"),
  async handler(argv) {
    const args = argv as unknown as IArgs;
    const logger = new Logger();

    const channel = args.channel;

    const validation = validateConfig(channel);
    if (!validation.valid) {
      validation.errors.forEach((error) => logger.error(error));
      process.exit(1);
    }

    const config = getConfig(channel);

    if (!isGitClean()) {
      logger.warn("Working directory has uncommitted changes");
    }

    if (!args.skipBuild) {
      logger.info("Building app bundles...");

      runx(
        args.exportDir !== "dist"
          ? `expo export --output-dir ${args.exportDir}`
          : `expo export`,
        { cwd: process.cwd(), stdio: "inherit" },
      );

      logger.success("Build completed");
    } else {
      logger.info(
        `Skipping build (using existing export from ${args.exportDir})`,
      );
    }

    const exportDir = checkExportDirectory(args.exportDir);
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
      ["Export Dir", args.exportDir],
      ["Channel", channel],
    ]);

    const results: {
      platform: PlatformType;
      status: "dry_run" | "uploaded" | "failed";
      bundle_size: number;
      asset_count: number;
      error?: string;
    }[] = [];

    for (const platform of platforms) {
      logger.section(platform.toUpperCase());

      try {
        const bundlePath = findBundleFile(exportDir, platform);
        const assetPaths = getAssetFiles(exportDir, metadata, platform);

        if (args.dryRun) {
          const summary = createDryRunSummary({
            platform,
            bundlePath,
            assetPaths,
            channel,
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
          logger.startSpinner(`Uploading ${platform}...`);

          await uploadBundle({
            platform,
            channel,
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
    if (args.dryRun) {
      logger.success("Dry run completed successfully!");
      logger.info("Run without --dry-run to perform actual upload");
    } else {
      logger.success("✨ Updates published successfully!");
    }
  },
};
