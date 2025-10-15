import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

export interface ICliOptions {
  channel?: string;
  skipBuild: boolean;
  dryRun: boolean;
  environment?: "development" | "preview" | "production";
  exportDir: string;
  prod: boolean;
  help?: boolean;
}

/**
 * Map EAS environment to channel
 */
function mapEnvironmentToChannel(
  environment?: string,
  prod?: boolean
): string | undefined {
  if (prod) return "production";
  if (environment === "production") return "production";
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
    .usage("$0 [options]")
    .usage("$0 --channel <channel>")
    .usage("$0 --prod")
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
    .example("$0 --channel production", "Deploy to production channel")
    .example("$0 --prod", "Deploy to production (EAS-style)")
    .example("$0 --environment preview", "Deploy to preview environment")
    .example("$0 -c staging --skip-build", "Deploy existing build to staging")
    .example(
      "$0 --dry-run --export-dir ./out",
      "Dry run with custom export directory"
    )
    .help()
    .alias("help", "h")
    .alias("version", "V")
    .strict()
    .parseSync();

  // Map EAS-style flags to our channel system
  let channel = args.channel as string | undefined;

  // If no channel specified, try to derive from EAS flags
  if (!channel) {
    channel = mapEnvironmentToChannel(
      args.environment as string,
      args.prod as boolean
    );
  }

  // Validation: ensure we have a channel
  if (!channel && !args.help) {
    console.error(chalk.red("Error: Channel is required"));
    console.log("Use one of the following:");
    console.log("  easc --channel production");
    console.log("  easc --prod");
    console.log("  easc --environment production");
    process.exit(1);
  }

  return {
    channel,
    skipBuild: args.skipBuild as boolean,
    dryRun: args.dryRun as boolean,
    environment: args.environment as
      | "development"
      | "preview"
      | "production"
      | undefined,
    exportDir: args.exportDir as string,
    prod: args.prod as boolean,
    help: args.help as boolean | undefined,
  };
}
