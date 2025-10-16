<div align="center">
  <img src="logo.png" alt="Cloudflare Expo OTA Updates" width="120"/>
</div>

# Cloudflare - Expo OTA Updates

This is a open source OTA update service for Expo apps, using Cloudflare workers, D1 database and R2 storage.

## Why Use This Project?

When deploying Expo OTA updates to an app with a large number of users the price can add up very quickly. Self hosting on Cloudflare can **drastically** lower these costs and potentially even get the price down to $0 per month (Cloudflare has an extremely generous free tier for it's services).

## Getting Started

1. **Install dependencies:**

```bash
pnpm install
```

2. **Follow the setup guides** below for configuring the worker and your app.

## Documentation

- [Cloudflare Setup](apps/worker/README.md) - Configure Cloudflare Workers, D1, and R2
- [App Setup](packages/easc/README.md) - Integrate OTA updates into your Expo app

## Features

- Manage and deploy updates for multiple apps
- Secure deployments using api keys and ip restrictions
- Super fast CDN integration using Cloudflare R2
- Easily migrate existing apps using `easc` (a drop in replacement for `eas`)
