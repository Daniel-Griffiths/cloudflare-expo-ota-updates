import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { CommandModule } from "yargs";
import { Logger } from "../utils/logger";
import { Platform, PlatformType } from "../enums/platform";
import { runx } from "../utils/runx";

interface IArgs {
  path?: string;
  profile?: string;
  platform: PlatformType | "all";
}

/**
 * Get the artifact pattern for a platform.
 * These patterns match EAS Build local output:
 * - iOS simulator builds: .tar.gz (contains .app)
 * - Android builds: .apk
 */
function getArtifactPattern(platform: PlatformType): string {
  return platform === Platform.iOS ? "build-*.tar.gz" : "build-*.apk";
}

/**
 * Find the latest build artifact matching a pattern
 */
function findLatestArtifact(pattern: string): string | null {
  const cwd = process.cwd();
  const files = fs.readdirSync(cwd).filter((f) => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return regex.test(f);
  });

  if (files.length === 0) return null;

  return (
    files
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(cwd, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0]?.name ?? null
  );
}

export const buildRun: CommandModule = {
  command: "build:run",
  describe: "Build locally and run on simulator/emulator",
  builder: (yargs) =>
    yargs
      .option("platform", {
        alias: "p",
        type: "string",
        choices: [Platform.iOS, Platform.Android, "all"] as const,
        description: "Target platform",
        demandOption: true,
      })
      .option("profile", {
        alias: "e",
        type: "string",
        description:
          'Name of the build profile from eas.json. Defaults to "production" if defined in eas.json.',
      })
      .option("path", {
        type: "string",
        description:
          "Path to the simulator/emulator build archive or app (skips build)",
      })
      .example(
        "$0 build:run -p ios -e preview",
        "Build with preview profile and run on iOS Simulator",
      )
      .example(
        "$0 build:run -p android",
        "Build with default profile and run on Android Emulator",
      )
      .example(
        "$0 build:run -p ios --path ./build.tar.gz",
        "Run existing build artifact",
      ),
  async handler(argv) {
    const args = argv as unknown as IArgs;
    const logger = new Logger();

    try {
      const platforms: PlatformType[] =
        args.platform === "all"
          ? [Platform.iOS, Platform.Android]
          : [args.platform];

      for (const platform of platforms) {
        const platformName = platform === Platform.iOS ? "iOS" : "Android";
        const artifactPattern = getArtifactPattern(platform);

        logger.section(`${platformName} Build & Run`);

        let artifactPath: string | null = null;
        let didBuild = false;

        if (args.path) {
          artifactPath = args.path;
          if (!fs.existsSync(artifactPath)) {
            logger.error(`Artifact not found: ${artifactPath}`);
            process.exit(1);
          }
          logger.info(`Using provided artifact: ${artifactPath}`);
        }

        if (!artifactPath) {
          didBuild = true;

          logger.startSpinner(`Running prebuild for ${platformName}...`);

          runx(`expo prebuild --platform ${platform} --clean`, {
            cwd: process.cwd(),
            stdio: "ignore",
            env: { ...process.env, CI: "1" },
          });

          logger.succeedSpinner("Prebuild completed");
          logger.startSpinner(`Building ${platformName} locally...`);

          const buildFlags = [
            `--platform ${platform}`,
            args.profile ? `--profile ${args.profile}` : "",
            "--local",
            "--non-interactive",
          ]
            .filter(Boolean)
            .join(" ");

          runx(`eas build ${buildFlags}`, {
            cwd: process.cwd(),
            stdio: "inherit",
          });

          logger.succeedSpinner(`${platformName} build completed`);

          artifactPath = findLatestArtifact(artifactPattern);

          if (!artifactPath) {
            logger.error(`No build artifact found after build`);
            process.exit(1);
          }

          logger.info(`Build artifact: ${artifactPath}`);
        }

        logger.startSpinner(
          `Installing on ${platformName} simulator/emulator...`,
        );

        runx(`eas build:run --path "${artifactPath}" --platform ${platform}`, {
          cwd: process.cwd(),
          stdio: "inherit",
        });

        logger.succeedSpinner(`${platformName} app installed and running`);

        if (didBuild && artifactPath && fs.existsSync(artifactPath)) {
          fs.unlinkSync(artifactPath);
          logger.info(`Cleaned up: ${artifactPath}`);
        }
      }

      logger.section("");
      logger.success("Done! App is running on simulator/emulator.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Build:run failed: ${message}`));
      process.exit(1);
    }
  },
};
