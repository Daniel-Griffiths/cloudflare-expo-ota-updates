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

## Commands

### update

Deploy an OTA update to the specified channel.

```bash
easc update --channel production        # Deploy OTA update
easc update --prod                      # Shorthand for production
easc update --dry-run                   # Preview without uploading
easc update --skip-build                # Use existing export
```

### build

Build the app locally and optionally submit to app stores.

```bash
easc build                              # Build all platforms locally
easc build --platform ios               # iOS only
easc build --platform android           # Android only
easc build --profile development        # Use dev profile
easc build --auto-submit                # Auto-submit to stores
easc build --clear-cache                # Clean prebuild
easc build --output ./build.ipa         # Custom output path
```

## Publishing

To publish this package to npm:

```bash
cd apps/easc
npm publish
```

Keep in mind that you'll have to change the name to somthing other than easc if you are not a admin on this project. You may wish to publish your own custom version for extra security.
