# easc

**E**xpo **A**pp **S**ervices for **C**loudflare - CLI tool for deploying Expo OTA updates to Cloudflare Workers.

## Getting Started

### 1. Link for Local Testing

To test the easc locally, you link the package to replace the published package with your local copy.

```bash
# From this directory
pnpm link --global

# Now you can use 'easc' command globally
easc --help
easc update --help
```

Or can also run directly with tsx:

```bash
tsx index.ts --help
tsx index.ts update --help
```

## Publishing

To publish this package to npm:

```bash
cd packages/deploy
pnpm run build
pnpm publish
```

Keep in mind that you'll have to change the name to somthing other than easc if you are not a admin on this project. You may wish to publish your own custom version for extra security.
