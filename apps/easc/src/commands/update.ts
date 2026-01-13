import { execSync } from "child_process";
import fs from "fs";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
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

type IDeploymentResult = {
  platform: PlatformType;
  status: "dry_run" | "uploaded" | "failed";
  bundle_size: number;
  asset_count: number;
  error?: string;
};

export interface ICliOptions {
  channel?: string | undefined;
  skipBuild: boolean;
  dryRun: boolean;
  environment?: "development" | "preview" | "production" | undefined;
  exportDir: string;
  prod: boolean;
  help?: boolean | undefined;
}

/**
 * Map EAS environment to channel
 */
function mapEnvironmentToChannel(
  environment?: string,
  isShorthandProd?: boolean
): string | undefined {
  if (environment === "production" || isShorthandProd) return "production";
  if (environment === "preview") return "staging";
  if (environment === "development") return "dev";
  return undefined;
}

/**
 * Parse command line arguments
 */
export function parseArguments(argv: string[] = process.argv): ICliOptions {
  const args = yargs(hideBin(argv))
    .scriptName("easc")
    .usage("$0 <command> [options]")
    .command(
      "update",
      "Deploy an OTA update to the specified channel",
      (yargs) => {
        return yargs
          .option("channel", {
            alias: "c",
            type: "string",
            description: "Deployment channel (e.g., production, staging)",
          })
          .option("skip-build", {
            type: "boolean",
            description: "Skip running 'expo export' (use existing build)",
            default: false,
          })
          .option("dry-run", {
            type: "boolean",
            description:
              "Outputs deployment info instead of uploading (preview what would be deployed)",
            default: false,
          })
          .option("environment", {
            type: "string",
            choices: ["development", "preview", "production"],
            description: "Environment variable's environment",
          })
          .option("export-dir", {
            type: "string",
            description: "Directory where the Expo project was exported",
            default: "dist",
          })
          .option("prod", {
            type: "boolean",
            description:
              "Create a new production deployment (shorthand for --channel production)",
            default: false,
          })
          .example(
            "$0 update --channel production",
            "Deploy to production channel"
          )
          .example("$0 update --prod", "Deploy to production (EAS-style)")
          .example(
            "$0 update --environment preview",
            "Deploy to preview environment"
          )
          .example(
            "$0 update -c staging --skip-build",
            "Deploy existing build to staging"
          )
          .example(
            "$0 update --dry-run --export-dir ./out",
            "Dry run with custom export directory"
          );
      }
    )
    .demandCommand(1, "")
    .showHelpOnFail(true)
    .help()
    .alias("help", "h")
    .alias("version", "V")
    .strict()
    .parseSync();

  // Map EAS-style flags to our channel system
  let channel = args["channel"] as string | undefined;

  // If no channel specified, try to derive from EAS flags
  if (!channel) {
    channel = mapEnvironmentToChannel(
      args["environment"] as string,
      args["prod"] as boolean
    );
  }

  if (!channel && !args["help"]) {
    console.error(chalk.red("Error: Channel is required"));
    console.log("Use one of the following:");
    console.log("  easc update --channel production");
    console.log("  easc update --prod");
    console.log("  easc update --environment production");
    process.exit(1);
  }

  return {
    channel,
    skipBuild: args["skipBuild"] as boolean,
    dryRun: args["dryRun"] as boolean,
    environment: args["environment"] as
      | "development"
      | "preview"
      | "production"
      | undefined,
    exportDir: args["exportDir"] as string,
    prod: args["prod"] as boolean,
    help: args["help"] as boolean | undefined,
  };
}

export const update = async () => {
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
};
