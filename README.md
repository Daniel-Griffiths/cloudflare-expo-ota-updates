<div align="center">
  <img src="docs/assets/logo.png" alt="Cloudflare Expo OTA Updates" width="120"/>
</div>

# Cloudflare - Expo OTA Updates

An open source OTA update service for Expo apps using Cloudflare workers.

[![Quick Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Daniel-Griffiths/cloudflare-expo-ota-updates/tree/master/apps/worker)

> **Note:** After using the quick deploy, it's recomended that you setup the worker security rules. See the [Cloudflare Setup](docs/SETUP_WORKER.md#secure-the-worker) guide for details.

## Why Use This Project?

When deploying Expo OTA updates to an app with a large number of users the price can add up very quickly. Self hosting on Cloudflare can **drastically** lower these costs and potentially even get the price down to $0 per month (Cloudflare has an extremely generous free tier for it's services).

## Setup Guide

Follow the setup guides below for configuring the worker and your app.

- [Cloudflare Setup](docs/SETUP_WORKER.md) - Configure Cloudflare Workers, D1, and R2
- [App Setup](docs/SETUP_APP.md) - Integrate OTA updates into your Expo app

## Features

- Manage and deploy updates for multiple apps
- Secure deployments using api keys and ip restrictions
- Super fast CDN integration using Cloudflare R2
- Easily migrate existing apps using `easc` (a drop in replacement for `eas`)
