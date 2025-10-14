<div align="center">
  <img src="docs/assets/logo.png" alt="Cloudflare Expo OTA Updates" width="120"/>
</div>

# Cloudflare - Expo OTA Updates

This is a open source update OTA update service for Expo apps, using a Cloudflare worker, D1 database and R2 storage.

## Project Structure

This is a monorepo using pnpm workspaces:
- `apps/worker` - The Cloudflare Worker application and CLI
- `packages/deploy` - Deploy tool for publishing OTA updates (future npm package)

## Getting Started

1. **Install dependencies:**
```bash
pnpm install
```

2. **Follow the setup guides** below for configuring the worker and your app.

## Documentation

- [Cloudflare Setup](docs/SETUP_CLOUDFLARE.md) - Configure Cloudflare Workers, D1, and R2
- [App Setup](docs/SETUP_APP.md) - Integrate OTA updates into your Expo app
- [CLI Usage](docs/CLI.md) - Command-line tools for managing updates

## Features

- Support multiple applications for OTA updates
- Secure deployments using api keys and ip restrictions
- Super fast CDN Integration using Cloudflare
- ...save money!
