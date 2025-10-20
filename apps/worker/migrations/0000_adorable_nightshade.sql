CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`api_key` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_api_key_unique` ON `apps` (`api_key`);--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`channel` text NOT NULL,
	`runtime_version` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` text NOT NULL,
	`launch_asset_key` text NOT NULL,
	`launch_asset_hash` text NOT NULL,
	`launch_asset_file_extension` text NOT NULL,
	`launch_asset_content_type` text NOT NULL,
	`launch_asset_url` text NOT NULL,
	`assets_json` text NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`commit_hash` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_updates_lookup` ON `updates` (`app_id`,`channel`,`runtime_version`,`platform`,`created_at`);