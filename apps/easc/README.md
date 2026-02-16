# easc

**E**xpo **A**pp **S**ervices for **C**loudflare - CLI tool for deploying Expo OTA updates to Cloudflare Workers.

## Usage

Run without arguments to enter interactive mode:

```bash
easc
```

Or run commands directly:

```bash
easc build --platform ios --profile preview
easc update --channel production
```

Use `--non-interactive` flag for CI environments:

```bash
easc submit --platform ios --profile production --non-interactive
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

Build locally and run on simulator/emulator. Always runs `expo prebuild --clean` before building.

```bash
easc build --platform ios               # Build and run on iOS Simulator
easc build --platform android           # Build and run on Android Emulator
easc build --platform ios --profile preview  # Use specific build profile
easc build --platform ios --path ./build.tar.gz  # Run existing artifact (skip build)
```

### submit

Build the app locally and optionally submit to app stores.

```bash
easc submit                              # Build all platforms locally
easc submit --platform ios               # iOS only
easc submit --platform android           # Android only
easc submit --profile development        # Use dev profile
easc submit --auto-submit                # Auto-submit to stores
easc submit --clear-cache                # Clean prebuild
easc submit --output ./build.ipa         # Custom output path
```

## Development

### Local Testing

To test easc locally, link the package:

```bash
# From this directory
pnpm link --global

# Now you can use 'easc' command globally
easc --help
```

Or run directly with tsx:

```bash
tsx index.ts --help
```

### Publishing

```bash
pnpm version patch && pnpm publish
```
