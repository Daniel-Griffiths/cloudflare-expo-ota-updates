# Setup Cloudflare Worker

## Getting Started

Install dependencies

```bash
pnpm install
```

Authenticate with your Cloudflare account (This will open a browser window to authorize Wrangler)

```bash
npx wrangler login
```

## Configuration

**1. Create D1 Database**

```bash
npx wrangler d1 create expo-ota-updates
```

Take the `database_id` returned from this command and add it to `wrangler.toml`

```bash
cp apps/worker/wrangler.example.toml apps/worker/wrangler.toml
```

```toml
database_id = "1234-1234-1234-1234"
```

**2. Initialize Database Schema**

Create the initial database tables:

```bash
# Local
npx wrangler d1 migrations apply expo-ota-updates --local

# Remote
npx wrangler d1 migrations apply expo-ota-updates --remote
```

**3. Add Your First App to The Database**

Use the CLI to create a new app in the database:

```bash
pnpm run cli create-app
```

> [!NOTE]  
> Save your `YOUR_API_KEY` - you'll need it for uploading updates later.

**4. Create R2 Bucket**

This is where your update files will be stored.

```bash
npx wrangler r2 bucket create expo-ota-updates
```

**5. Configure R2 Public Access**

Choose one of the following options to make your R2 bucket publicly accessible:

**Option A: Custom Domain (Recommended for Production)**

1. Go to Cloudflare Dashboard → R2
2. Select your `expo-ota-updates` bucket
3. Go to Settings → **Domain Access**
4. Click **Connect Domain**
5. Enter your custom domain (e.g., `updates.yourdomain.com`)
   - The domain must be on Cloudflare DNS
   - DNS will be automatically configured
6. Update `apps/worker/wrangler.toml` with your domain in the `BUCKET_URL` variable:
   ```toml
   BUCKET_URL = "https://updates.yourdomain.com"
   ```

**Option B: R2.dev Subdomain (For Testing/Development)**

1. Enable R2.dev subdomain:

   ```bash
   npx wrangler r2 bucket domain enable expo-ota-updates
   ```

2. Get the public URL:

   ```bash
   npx wrangler r2 bucket domain list expo-ota-updates
   ```

   This will output something like: `https://pub-abc123def456.r2.dev`

3. Update `apps/worker/wrangler.toml` with this URL in the `BUCKET_URL` variable:
   ```toml
   BUCKET_URL = "https://pub-abc123def456.r2.dev"
   ```

> [!WARNING]  
> R2.dev URLs are rate-limited and intended for testing only. Use a custom domain for production.

**6. Check wrangler.toml**

Ok so before we deploy, let's make sure everything looks correct in `apps/worker/wrangler.toml`

| Variable              | Required | Description                                                                                     |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `database_id`         | ✅       | Replace `YOUR_DATABASE_ID` with your D1 database ID from step 2                                 |
| `BUCKET_URL`          | ✅       | Replace with your R2 public URL from step 6 (custom domain or R2.dev subdomain)                 |
| `bucket_name`         | ❌       | Replace `expo-ota-updates` if you used a different bucket name                                  |
| `MAX_UPDATES_TO_KEEP` | ❌       | Number of updates to keep per channel/platform/runtime (set to 0 to keep all)                   |
| `ALLOWED_UPLOAD_IPS`  | ❌       | Comma-separated list of IP addresses allowed to upload builds (highly recommended for security) |

> [!NOTE]  
> When using ALLOWED_UPLOAD_IPS, be sure to add both your ipv4 and ipv6 addresses (if you use ipv6)

**7. Deployment**

Now let's deploy the worker to Cloudflare! If you ever change the .toml values you must redeploy the worker (or manually update them in Cloudflare).

```bash
# Deploy to Cloudflare Workers
pnpm run deploy
```

> [!NOTE]
> If you are having issues use `npx wrangler tail` to debug the worker logs when sending/downloading updates

**8. Secure The Worker**

It's very common for malicious bot's to scan domains for security exploits, this eats into your free worker usage. To prevent this it's highly recomended to setup security rules for your domain.

1. Go to Cloudflare Dashboard → choose your domain
2. Select **Security** → **Security Rules**
3. Click **Create Rule** → **Custom Rule**
4. Click **Edit Expression**

Then you can paste this, but we sure to enter the update domain we created earlier:

```
(http.host eq "updates.yourdomain.com" and http.request.uri.path ne "/upload" and http.request.uri.path ne "/manifest")
```

Then you can click **Save**. This will now prevent bots access random url's like `updates.yourdomain.com/wp-admin` racking up your worker usage.

You could also create addtional rules here, for example you could restrict your upload endpoint to only be accessible from a particular country, or retrict it by IP to add an additional layer on top of the build in worker IP list.
