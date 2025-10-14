import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

export interface CliOptions {
  // Our main flags
  channel?: string;
  skipBuild: boolean;
  verbose: boolean;
  dryRun: boolean;

  // EAS-compatible flags
  alias?: string;
  environment?: "development" | "preview" | "production";
  exportDir: string;
  id?: string;
  json: boolean;
  nonInteractive: boolean;
  prod: boolean;

  help?: boolean;
}

/**
 * Map EAS environment to channel
 */
function mapEnvironmentToChannel(environment?: string, prod?: boolean): string | undefined {
  if (prod) return "production";
  if (environment === "production") return "production";
  if (environment === "preview") return "staging";
  if (environment === "development") return "dev";
  return undefined;
}

/**
 * Parse command line arguments with EAS compatibility
 */
export function parseArguments(argv: string[] = process.argv): CliOptions {
  const args = yargs(hideBin(argv))
    .scriptName("easc")
    .usage("$0 [options]")
    .usage("$0 --channel <channel>")
    .usage("$0 --prod")

    // Our original flags
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
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Show verbose output",
      default: false,
    })

    // EAS-compatible flags
    .option("dry-run", {
      type: "boolean",
      description: "Outputs deployment info instead of uploading (preview what would be deployed)",
      default: false,
    })
    .option("alias", {
      type: "string",
      description: "Custom alias to assign to the new deployment (stored as metadata)",
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
    .option("id", {
      type: "string",
      description: "Custom unique identifier for the new deployment",
    })
    .option("json", {
      type: "boolean",
      description: "Enable JSON output, non-JSON messages will be printed to stderr",
      default: false,
    })
    .option("non-interactive", {
      type: "boolean",
      description: "Run the command in non-interactive mode",
      default: false,
    })
    .option("prod", {
      type: "boolean",
      description: "Create a new production deployment (shorthand for --channel production)",
      default: false,
    })

    // Examples
    .example("$0 --channel production", "Deploy to production channel")
    .example("$0 --prod", "Deploy to production (EAS-style)")
    .example("$0 --environment preview", "Deploy to preview environment")
    .example("$0 -c staging --skip-build", "Deploy existing build to staging")
    .example("$0 --dry-run --export-dir ./out", "Dry run with custom export directory")

    // Help and version
    .epilogue(
      `${chalk.bold("Compatibility:")} This tool is compatible with EAS Deploy flags for easy migration.\n` +
      `${chalk.bold("Documentation:")} ${chalk.cyan(
        "https://github.com/yourusername/cloudflare-expo-ota-updates"
      )}`
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
    channel = mapEnvironmentToChannel(args.environment as string, args.prod as boolean);
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
    verbose: args.verbose as boolean,
    dryRun: args.dryRun as boolean,

    // EAS flags
    alias: args.alias as string | undefined,
    environment: args.environment as "development" | "preview" | "production" | undefined,
    exportDir: args.exportDir as string,
    id: args.id as string | undefined,
    json: args.json as boolean,
    nonInteractive: args.nonInteractive as boolean,
    prod: args.prod as boolean,

    help: args.help as boolean | undefined,
  };
}

/**
 * Get version from package.json
 */
export function getVersion(): string {
  try {
    // When compiled, this will be relative to dist/
    const packageJson = require("../../package.json");
    return packageJson.version;
  } catch {
    return "unknown";
  }
}

/**
 * Show EAS compatibility notice for stubbed features
 */
export function showCompatibilityNotices(options: CliOptions): void {
  const notices: string[] = [];

  if (options.alias) {
    notices.push(`${chalk.dim("ℹ")} Alias '${options.alias}' will be stored as deployment metadata`);
  }

  if (options.id) {
    notices.push(`${chalk.dim("ℹ")} Custom ID '${options.id}' will be used for this deployment`);
  }

  if (options.nonInteractive) {
    notices.push(`${chalk.dim("ℹ")} Running in non-interactive mode`);
  }

  if (notices.length > 0) {
    notices.forEach(notice => console.log(notice));
    console.log(); // Empty line after notices
  }
}