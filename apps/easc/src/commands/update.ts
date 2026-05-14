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
import { createFingerprintAsync } from "@expo/fingerprint";
import { Logger } from "../utils/logger";
import { runx } from "../utils/runx";

interface IArgs {
  channel: string;
  skipBuild: boolean;
  dryRun: boolean;
  exportDir: string;
  nonInteractive: boolean;
  dangerouslyIgnoreFingerprintCheck: boolean;
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
      .option("dangerously-ignore-fingerprint-check", {
        type: "boolean",
        description:
          "Skip fingerprint validation when native dependencies have changed",
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
          ? `expo export --dump-sourcemap --output-dir ${args.exportDir}`
          : `expo export --dump-sourcemap`,
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

    logger.info("Generating native fingerprint...");
    const { hash: fingerprint } = await createFingerprintAsync(process.cwd());
    logger.success(`Fingerprint: ${fingerprint}`);

    logger.section("📤 Deployment Info");
    logger.table([
      ["Server", config.otaServer],
      ["Runtime", runtimeVersion],
      ["Commit", shortCommit || ""],
      ["Fingerprint", fingerprint || ""],
      ["Export Dir", args.exportDir],
      ["Channel", channel],
    ]);

    const platformUploads = platforms.map((platform) => ({
      platform,
      bundlePath: findBundleFile(exportDir, metadata, platform),
      assetPaths: getAssetFiles(exportDir, metadata, platform),
    }));

    if (args.dryRun) {
      for (const { platform, bundlePath, assetPaths } of platformUploads) {
        logger.section(platform.toUpperCase());
        logger.box(
          createDryRunSummary({
            platform,
            bundlePath,
            assetPaths,
            channel,
            runtimeVersion,
            commitHash,
          }),
        );
        logger.success(`${platform} (dry run)`);
      }
    } else {
      logger.startSpinner(
        platformUploads.map(({ platform }) => `Uploading ${platform}...`),
      );

      const results = await Promise.allSettled(
        platformUploads.map(async ({ platform, bundlePath, assetPaths }) => {
          const label = `Uploading ${platform}...`;
          try {
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
              fingerprint,
              ignoreFingerprintCheck: args.dangerouslyIgnoreFingerprintCheck,
            });
            logger.updateSpinner(label, "done");
          } catch (error) {
            logger.updateSpinner(label, "failed");
            throw error;
          }
        }),
      );

      logger.stopSpinner();

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw (failed[0] as PromiseRejectedResult).reason;
      }
    }

    logger.section("");
    if (args.dryRun) {
      logger.success("Dry run completed successfully!");
      logger.info("Run without --dry-run to perform actual upload");
    } else {
      logger.log("✨ Updates published successfully!");
    }
  },
};
