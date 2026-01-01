import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const updates = sqliteTable(
  "updates",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    runtimeVersion: text("runtime_version").notNull(),
    platform: text("platform").notNull(),
    createdAt: text("created_at").notNull(),
    lastDownloadedAt: text("last_downloaded_at"),
    launchAssetKey: text("launch_asset_key").notNull(),
    launchAssetHash: text("launch_asset_hash").notNull(),
    launchAssetFileExtension: text("launch_asset_file_extension").notNull(),
    launchAssetContentType: text("launch_asset_content_type").notNull(),
    launchAssetUrl: text("launch_asset_url").notNull(),
    assetsJson: text("assets_json").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    commitHash: text("commit_hash"),
    expoConfigJson: text("expo_config_json"),
  },
  (table) => [
    index("idx_updates_lookup").on(
      table.appId,
      table.channel,
      table.runtimeVersion,
      table.platform,
      table.createdAt
    ),
  ]
);

export type IApp = typeof apps.$inferSelect;
export type IInsertApp = typeof apps.$inferInsert;
export type IUpdate = typeof updates.$inferSelect;
export type IInsertUpdate = typeof updates.$inferInsert;
