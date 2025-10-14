import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

export async function createApp() {
  console.log(chalk.cyan.bold("\n📱 Create New App\n"));

  const appName = await input({
    message: "App Name:",
    required: true,
    validate: (value) => (value.trim() ? true : "App name is required"),
  });

  const appId = appName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const apiKey = randomUUID();

  console.log(chalk.gray(`\nGenerated App ID: ${chalk.white(appId)}`));
  console.log(chalk.gray(`Generated API Key: ${chalk.white(apiKey)}`));

  const environment = await select({
    message: "Select environment:",
    choices: [
      { name: "Local", value: "local" },
      { name: "Remote", value: "remote" },
    ],
  });

  const spinner = ora("Creating app...").start();

  try {
    const envFlag = environment === "local" ? "--local" : "--remote";
    const sql = `INSERT INTO apps (id, name, api_key) VALUES ('${appId}', '${appName}', '${apiKey}')`;
    const command = `yarn exec wrangler -- d1 execute expo-ota-updates ${envFlag} --command="${sql}"`;

    execSync(command, { encoding: "utf-8", stdio: "pipe" });

    spinner.succeed(chalk.green("App created successfully!"));

    console.log(chalk.cyan("\n📋 App Details:\n"));
    console.log(`${chalk.gray("App ID:")}       ${chalk.white(appId)}`);
    console.log(`${chalk.gray("App Name:")}     ${chalk.white(appName)}`);
    console.log(`${chalk.gray("API Key:")}      ${chalk.white(apiKey)}`);
    console.log(`${chalk.gray("Environment:")}  ${chalk.white(environment)}`);

    console.log(
      chalk.yellow(
        "\n⚠️  Important: Save your API key - you'll need it to upload updates!\n"
      )
    );
  } catch (error) {
    spinner.fail(chalk.red("Failed to create app"));
    if (error instanceof Error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        console.error(
          chalk.red(`\n❌ An app with ID "${appId}" already exists.`)
        );
        console.error(
          chalk.yellow(
            `💡 The ID is generated from your app name. Please choose a different app name.\n`
          )
        );
      } else {
        console.error(chalk.red(`\n❌ ${error.message}\n`));
      }
    }
    process.exit(1);
  }
}
