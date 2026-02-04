import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { CommandModule } from "yargs";
import { Logger } from "../utils/logger";
import { Platform, PlatformType } from "../enums/platform";
import { runx } from "../utils/runx";
import { getEasProfiles } from "../utils/eas";

interface IArgs {
  platform: PlatformType | "all";
  profile: string;
  autoSubmit: boolean;
  clearCache: boolean;
  output?: string;
  nonInteractive: boolean;
}

function findBuildArtifact(pattern: string): string | null {
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

export const build: CommandModule = {
  command: "build",
  describe: "Build the app locally",
  builder: (yargs) =>
    yargs
      .option("platform", {
        alias: "p",
        type: "string",
        choices: [Platform.iOS, Platform.Android, "all"] as const,
        description: "Target platform",
      })
      .option("profile", {
        alias: "e",
        type: "string",
        choices: getEasProfiles(),
        description: "EAS build profile",
      })
      .option("auto-submit", {
        alias: "s",
        type: "boolean",
        description: "Submit to app stores after building",
        default: false,
      })
      .option("clear-cache", {
        type: "boolean",
        description: "Clear cache before building",
        default: false,
      })
      .option("output", {
        type: "string",
        description: "Output path for the build artifact",
      })
      .option("non-interactive", {
        type: "boolean",
        description: "Never prompt for user input",
        default: false,
      })
      .example("$0 build", "Build all platforms locally")
      .example("$0 build -p ios -e development", "Build iOS with dev profile")
      .example("$0 build -s", "Build and submit to stores"),
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

        logger.section(`${platformName} Build`);

        if (args.clearCache) {
          logger.info(`Running prebuild for ${platformName}...`);
          runx(`expo prebuild --platform ${platform} --clean`, {
            cwd: process.cwd(),
            stdio: "inherit",
            env: { ...process.env, CI: "1" },
          });
          logger.success("Prebuild completed");
        }

        logger.info(`Building ${platformName} locally...`);

        const buildFlags = [
          `--platform ${platform}`,
          `--profile ${args.profile}`,
          "--local",
          "--non-interactive",
          args.clearCache ? "--clear-cache" : "",
          args.output ? `--output ${args.output}` : "",
        ]
          .filter(Boolean)
          .join(" ");

        runx(`eas build ${buildFlags}`, {
          cwd: process.cwd(),
          stdio: "inherit",
        });

        logger.success(`${platformName} build completed`);

        if (args.autoSubmit) {
          logger.info(`Submitting ${platformName} build...`);

          const artifactPath =
            platform === Platform.iOS
              ? findBuildArtifact("build-*.ipa")
              : findBuildArtifact("build-*.aab") ||
                findBuildArtifact("build-*.apk");

          if (!artifactPath) {
            logger.error(`No ${platformName} build artifact found`);
            process.exit(1);
          }

          logger.info(`Found artifact: ${artifactPath}`);

          runx(
            `eas submit --platform ${platform} --path "${artifactPath}" --non-interactive`,
            { cwd: process.cwd(), stdio: "inherit" },
          );

          logger.success(`${platformName} submitted`);

          if (fs.existsSync(artifactPath)) {
            fs.unlinkSync(artifactPath);
            logger.info(`Cleaned up: ${artifactPath}`);
          }
        }
      }

      logger.section("");
      logger.success("Build completed!");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Build failed: ${message}`));
      process.exit(1);
    }
  },
};
