import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { queryDatabase, type IAppRow } from "../utils/db.js";

interface IAppStats {
  app_id: string;
  total_updates: number;
  platforms: string;
  channels: string;
  latest_update: string;
  total_downloads: number;
}

export async function listApps() {
  const spinner = ora("Loading apps...").start();

  try {
    const apps = await queryDatabase<IAppRow>(
      "SELECT id, name, api_key, created_at FROM apps ORDER BY created_at DESC"
    );

    if (apps.length === 0) {
      spinner.stop();
      console.log(chalk.yellow("\n⚠️  No apps found.\n"));
      return;
    }

    const stats = await queryDatabase<IAppStats>(`
      SELECT
        app_id,
        COUNT(*) as total_updates,
        GROUP_CONCAT(DISTINCT platform) as platforms,
        GROUP_CONCAT(DISTINCT channel) as channels,
        MAX(created_at) as latest_update,
        SUM(download_count) as total_downloads
      FROM updates
      GROUP BY app_id
    `);

    spinner.succeed(chalk.green(`Found ${apps.length} app(s)`));

    const table = new Table({
      head: [
        chalk.cyan("App Name"),
        chalk.cyan("App ID"),
        chalk.cyan("API Key"),
        chalk.cyan("Updates"),
        chalk.cyan("Downloads"),
        chalk.cyan("Platforms"),
        chalk.cyan("Channels"),
        chalk.cyan("Latest Update"),
      ],
      style: {
        head: [],
        border: ["gray"],
      },
    });

    for (const app of apps) {
      const appStats = stats.find((s) => s.app_id === app.id);
      const apiKeyPreview = app.api_key.substring(0, 8) + "...";

      table.push([
        chalk.bold(app.name),
        chalk.gray(app.id),
        chalk.gray(apiKeyPreview),
        appStats ? appStats.total_updates.toString() : "0",
        appStats ? (appStats.total_downloads || 0).toString() : "0",
        appStats ? appStats.platforms || "none" : "none",
        appStats ? appStats.channels || "none" : "none",
        appStats ? new Date(appStats.latest_update).toLocaleString() : "never",
      ]);
    }

    console.log("\n" + table.toString() + "\n");
  } catch (error) {
    spinner.fail(chalk.red("Failed to load apps"));
    throw error;
  }
}
