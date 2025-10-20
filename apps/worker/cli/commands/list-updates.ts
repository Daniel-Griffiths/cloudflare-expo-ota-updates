import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { queryDatabase, type IAppRow, type IUpdateRow } from "../utils/db.js";

export async function listUpdates() {
  const spinner = ora("Loading apps...").start();

  try {
    const apps = await queryDatabase<IAppRow>(
      "SELECT id, name FROM apps ORDER BY name"
    );

    if (apps.length === 0) {
      spinner.stop();
      console.log(chalk.yellow("\n⚠️  No apps found.\n"));
      return;
    }

    spinner.stop();

    const appId = await select({
      message: "Select an app:",
      choices: apps.map((app) => ({
        name: app.name,
        value: app.id,
      })),
    });

    const selectedApp = apps.find((a) => a.id === appId);

    const channel = await input({
      message: "Filter by channel (press Enter to show all):",
      default: "",
    });

    const platform = await select({
      message: "Filter by platform:",
      choices: [
        { name: "All", value: "" },
        { name: "iOS", value: "ios" },
        { name: "Android", value: "android" },
      ],
    });

    let query = `SELECT id, channel, runtime_version, platform, created_at, launch_asset_url, download_count, commit_hash FROM updates WHERE app_id = '${appId}'`;

    if (channel) {
      query += ` AND channel = '${channel}'`;
    }

    if (platform) {
      query += ` AND platform = '${platform}'`;
    }

    query += " ORDER BY created_at DESC LIMIT 20";

    const loadSpinner = ora("Loading updates...").start();
    const updates = await queryDatabase<IUpdateRow>(query);

    if (updates.length === 0) {
      loadSpinner.stop();
      console.log(
        chalk.yellow("\n⚠️  No updates found with the specified filters.\n")
      );
      return;
    }

    loadSpinner.succeed(chalk.green(`Found ${updates.length} update(s)`));

    console.log(chalk.cyan.bold(`\n📦 Updates for ${selectedApp?.name}\n`));

    const table = new Table({
      head: [
        chalk.cyan("Platform"),
        chalk.cyan("Channel"),
        chalk.cyan("Runtime"),
        chalk.cyan("Downloads"),
        chalk.cyan("Commit"),
        chalk.cyan("Update ID"),
        chalk.cyan("Created"),
      ],
      style: {
        head: [],
        border: ["gray"],
      },
      colWidths: [12, 15, 10, 12, 10, 38, 25],
    });

    for (const update of updates) {
      const commitShort = update.commit_hash
        ? update.commit_hash.substring(0, 7)
        : "-";
      table.push([
        `${chalk.bold(update.platform.toUpperCase())}`,
        update.channel,
        update.runtime_version,
        update.download_count.toString(),
        chalk.yellow(commitShort),
        chalk.gray(update.id),
        new Date(update.created_at).toLocaleString(),
      ]);
    }

    console.log(table.toString() + "\n");

    const groupedByChannel = updates.reduce((acc, u) => {
      acc[u.channel] = (acc[u.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryTable = new Table({
      head: [chalk.cyan("Summary")],
      style: {
        head: [],
        border: ["gray"],
      },
    });

    summaryTable.push(
      [chalk.gray(`Total: ${chalk.white(updates.length)} updates`)],
      ...Object.entries(groupedByChannel).map(([channel, count]) => [
        chalk.gray(`${channel}: ${chalk.white(count)} updates`),
      ])
    );

    console.log(summaryTable.toString() + "\n");
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
