# @cloudflare-expo-ota/worker

Cloudflare Worker that serves OTA (Over-The-Air) updates for Expo applications. Built with Hono, D1 (SQLite), and R2 storage.

## Getting Started

### 1. Configure Wrangler

Copy the example configuration:

```bash
cp apps/worker/wrangler.example.toml apps/worker/wrangler.toml
```

### 2. Create Local D1 Database

For local development, Wrangler automatically creates a local SQLite database. Initialize the schema:

```bash
# From monorepo root
pnpm db:generate
npx wrangler d1 migrations apply expo-ota-updates --local
```

### 3. Start dev Server

```bash
pnpm --filter worker dev
```

The worker will be available at `http://localhost:8787`
