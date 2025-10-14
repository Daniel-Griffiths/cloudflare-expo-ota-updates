# easc

**E**xpo **A**pp **S**erver for **C**loudflare - Deploy tool for Expo OTA updates to Cloudflare Workers.

## Usage

The tool requires the following environment variables:

- `OTA_SERVER`: The URL of your OTA server
- `OTA_API_KEY`: Your API key for authentication

You can set these in a `.env` file or export them in your shell.

Then you can run:

```bash
npx easc --channel production
```

### Deploy to a channel

```bash
npx easc --channel production
```

## Development

To work on this package locally:

```bash
# From the root of the monorepo
pnpm run build:deploy

# Test locally
cd packages/deploy
pnpm run dev -- --channel staging
```

## Publishing

To publish this package to npm:

```bash
cd packages/deploy
pnpm run build
pnpm publish
```
