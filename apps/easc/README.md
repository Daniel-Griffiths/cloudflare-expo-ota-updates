# easc

**E**xpo **A**pp **S**ervices for **C**loudflare - CLI tool for deploying Expo OTA updates to Cloudflare Workers.

## Usage

Run without arguments to enter interactive mode:

```bash
easc
```

Or run commands directly:

```bash
easc build --platform ios --profile development
easc update --channel production
```

Use `--non-interactive` flag for CI environments:

```bash
easc build --platform ios --profile production --non-interactive
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

### build:run

Build locally and run on simulator/emulator. Always runs `expo prebuild --clean` before building.

```bash
easc build:run --platform ios           # Build and run on iOS Simulator
easc build:run --platform android       # Build and run on Android Emulator
easc build:run --platform ios --profile preview  # Use specific build profile
easc build:run --platform ios --path ./build.tar.gz  # Run existing artifact (skip build)
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
