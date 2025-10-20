#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { createApp } from "./commands/create-app.js";
import { listApps } from "./commands/list-apps.js";
import { listUpdates } from "./commands/list-updates.js";

async function runInteractive() {
  console.log(chalk.cyan.bold("\n🚀 OTA Update Manager\n"));

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "➕ Create App", value: "create-app" },
      { name: "📱 List Apps", value: "list-apps" },
      { name: "📦 List Updates", value: "list-updates" },
      { name: "❌ Exit", value: "exit" },
    ],
  });

  switch (action) {
    case "list-apps":
      return listApps();
    case "list-updates":
      return listUpdates();
    case "create-app":
      return createApp();
    case "exit":
      process.exit(0);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command(
      "create-app",
      "Create a new app with auto-generated API key",
      {},
      async () => {
        await createApp();
      }
    )
    .command("list-apps", "List all apps with statistics", {}, async () => {
      await listApps();
    })
    .command(
      "list-updates",
      "List updates for a specific app",
      {},
      async () => {
        await listUpdates();
      }
    )
    .help()
    .alias("h", "help")
    .version(false)
    .strict()
    .parse();

  // If no command was provided, run interactive mode
  if (argv._.length === 0) {
    await runInteractive();
  }
}

main().catch((error) => {
  console.error(chalk.red("Error:"), error.message);
  process.exit(1);
});
