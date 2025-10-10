-- Apps table
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Updates table
CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL,
  launch_asset_key TEXT NOT NULL,
  launch_asset_hash TEXT NOT NULL,
  launch_asset_file_extension TEXT NOT NULL,
  launch_asset_content_type TEXT NOT NULL,
  launch_asset_url TEXT NOT NULL,
  assets_json TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  commit_hash TEXT,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_updates_lookup
ON updates(app_id, branch, runtime_version, platform, created_at DESC);
