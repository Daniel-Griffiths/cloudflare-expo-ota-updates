# Setup App

## Create Your First App

Before configuring your Expo app, you need to register it in the database. From the root of this project, run:

```bash
pnpm run cli create-app
```

This will prompt you for an app name and generate an **App ID** and **API Key**. Save these, you'll need them later.

## Finding Your Worker URL

After deployment, you can find your Worker URL by doing the following:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select **Workers & Pages** from the left sidebar
3. Click on your worker (e.g., `expo-ota-update`)
4. Go to the **Settings** tab
5. Scroll down to **Triggers** section
6. Your URL will be listed under **Routes** (e.g., `https://expo-ota-update.your-subdomain.workers.dev`)

The URL format is: `https://<worker-name>.<your-account-subdomain>.workers.dev`

Save this URL, you will need it for your Expo app configuration later on.

<details>
<summary>Local Development with Cloudflare Tunnel</summary>

When developing locally, you can use Cloudflare Tunnel to expose your local server to your Expo app for testing.

**1. Start your local development server:**

```bash
pnpm run dev
```

This starts the worker on `http://localhost:8787`

**2. In a new terminal, start Cloudflare Tunnel:**

```bash
cloudflared tunnel --url http://localhost:8787
```

**3. Use the tunnel URL in your app:**

Cloudflare Tunnel will provide a temporary public URL (e.g., `https://example.trycloudflare.com`). Use this URL in your Expo app's `app.json` during development:

```json
{
  "expo": {
    "updates": {
      "url": "https://example.trycloudflare.com/manifest"
    }
  }
}
```

**Note:** The tunnel URL changes each time you restart `cloudflared`, so you'll need to update your `app.json` accordingly.

</details>

## Expo App Configuration

To configure your Expo app to use this OTA update server, add the following to your `app.json`:

```json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "url": "https://expo-ota-server.your-subdomain.workers.dev/manifest",
      "enabled": true,
      "fallbackToCacheTimeout": 10000,
      "requestHeaders": {
        "expo-channel-name": "production",
        "expo-app-id": "YOUR_APP_ID"
      }
    }
  }
}
```

**Configuration Details:**

- `runtimeVersion`: Runtime version policy (use `{ "policy": "appVersion" }` to match app version)
- `updates.url`: Your Workers deployment URL + `/manifest` (see [Finding Your Worker URL](#finding-your-worker-url))
- `updates.enabled`: Set to `true` to enable OTA updates
- `updates.fallbackToCacheTimeout`: Milliseconds to wait before falling back to cached update
- `requestHeaders.expo-channel-name`: The channel name (e.g., "production", "staging")
- `requestHeaders.expo-app-id`: Your app ID from the create-app step (must match the ID in the database)

**Important Notes:**

- The `expo-app-id` in `requestHeaders` must match the app ID created in step 4
- The `expo-channel-name` corresponds to the `channel` parameter when uploading updates
- The `runtimeVersion` should match between your app and uploaded updates

## Deploying Updates

**1. Configure Environment Variables**

Create a `.env` file in your Expo project root:

```bash
OTA_SERVER=https://expo-ota-update.your-subdomain.workers.dev
OTA_API_KEY=your-api-key-from-step-4
```

**Important:** Use the actual Worker URL you found in the [Finding Your Worker URL](#finding-your-worker-url) section above.

**2. Add Package.json Script**

Deploy your update with `easc`

```bash
# Or "bunx" when using bun
npx easc update --channel production

# See a full list of commands/options
npx easc --help
npx easc update --help
```

## Known issues

### Assets not loading after an OTA update (expo-updates)

With `expo-updates` enabled, images and other assets can fail to load **after the user receives an OTA update** (on both iOS and Android). The first release build may show assets correctly; the issue appears once an update is downloaded and applied. This comes from how the React Native `Image` component resolves asset paths when updates are enabled.

**Reference:** [expo/expo#22656](https://github.com/expo/expo/issues/22656) (and [this comment](https://github.com/expo/expo/issues/22656#issuecomment-1628535353) for the workaround).

**Recommended fix:** add the following at the **very beginning** of your app entry file (e.g. `index.js` or `App.js`):

```js
import 'expo-asset';
```

`expo-asset` is a dependency of `expo` and registers a custom source transformer so `Image` resolves assets from the correct location (e.g. `.expo-internal`). Without this, assets may not be found in release builds when expo-updates is installed.
