import chalk from "chalk";
import { z } from "zod";

const envSchema = z.object({
  OTA_SERVER: z.url("OTA_SERVER must be a valid URL"),
  OTA_API_KEY: z.string().min(1, "OTA_API_KEY is required"),
});

const channelSchema = z
  .string()
  .min(1, "Channel name is required")
  .regex(
    /^[a-zA-Z0-9-_]+$/,
    "Channel names can only contain letters, numbers, hyphens, and underscores"
  );

const configSchema = z.object({
  channel: channelSchema,
  otaServer: z.url(),
  apiKey: z.string().min(1),
});

export type IConfig = z.infer<typeof configSchema>;

export interface IValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Format zod errors into user-friendly messages
 */
function formatZodError(error: z.ZodError, context?: string): string[] {
  return error.issues.map((err) => {
    const path = err.path.join(".");
    const message = err.message;

    if (context === "environment") {
      if (path === "OTA_SERVER") {
        return (
          `${chalk.red(
            "OTA_SERVER"
          )} environment variable is required or invalid\n` +
          `   Set it in your .env file or export it:\n` +
          `   export OTA_SERVER="https://your-ota-server.com"`
        );
      }
      if (path === "OTA_API_KEY") {
        return (
          `${chalk.red("OTA_API_KEY")} environment variable is required\n` +
          `   Set it in your .env file or export it:\n` +
          `   export OTA_API_KEY="your-api-key"`
        );
      }
    }

    if (context === "channel") {
      return (
        `Invalid channel: ${chalk.red(message)}\n` +
        `   Specify a valid channel:\n` +
        `   easc --channel production\n` +
        `   easc --channel staging`
      );
    }

    return `${chalk.red(path)}: ${message}`;
  });
}

/**
 * Validate environment variables using zod
 */
export function validateEnvironment(): IValidationResult {
  const result = envSchema.safeParse({
    OTA_SERVER: process.env["OTA_SERVER"],
    OTA_API_KEY: process.env["OTA_API_KEY"],
  });

  if (!result.success) {
    return {
      valid: false,
      errors: formatZodError(result.error, "environment"),
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate a channel name using zod
 */
export function validateChannel(
  channel: string | undefined
): IValidationResult {
  if (!channel) {
    return {
      valid: false,
      errors: [
        `${chalk.red("--channel")} flag is required\n` +
          `   Specify which channel to deploy to:\n` +
          `   easc --channel production\n` +
          `   easc --channel staging`,
      ],
    };
  }

  const result = channelSchema.safeParse(channel);

  if (!result.success) {
    return {
      valid: false,
      errors: formatZodError(result.error, "channel"),
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate all configuration
 */
export function validateConfig(channel: string | undefined): IValidationResult {
  const envResult = validateEnvironment();
  const channelResult = validateChannel(channel);

  return {
    valid: envResult.valid && channelResult.valid,
    errors: [...envResult.errors, ...channelResult.errors],
  };
}

/**
 * Get configuration from environment and arguments
 */
export function getConfig(channel: string): IConfig {
  return {
    channel,
    apiKey: process.env["OTA_API_KEY"]!,
    otaServer: process.env["OTA_SERVER"]!,
  };
}

/**
 * Validate server URL format
 */
export function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
