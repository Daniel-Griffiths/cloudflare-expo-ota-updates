# Setup Cloudflare

**1. Install Dependencies**

```bash
yarn install
```

**2. Create D1 Database**

```bash
yarn exec wrangler -- d1 create expo-ota-updates
```

Take the `database_id` returned from this command and add it to `wranger.toml`

```bash
cp wrangler.example.toml wrangler.toml
```

```toml
database_id = "1234-1234-1234-1234"
```

**3. Initialize Database Schema**

Create the initial database tables:

```bash
# Local
yarn exec wrangler -- d1 migrations apply expo-ota-updates --local

# Remote
yarn exec wrangler -- d1 migrations apply expo-ota-updates --remote
```

**4. Add Your First App to The Database**

Use the CLI to create a new app in the database:

```bash
yarn cli create-app
```

> [!NOTE]  
> Save your `YOUR_API_KEY` - you'll need it for uploading updates later.

**5. Create R2 Bucket**

This is where your update files will be stored.

```bash
yarn exec wrangler -- r2 bucket create expo-ota-updates
```

**6. Configure R2 Public Access**

Choose one of the following options to make your R2 bucket publicly accessible:

**Option A: Custom Domain (Recommended for Production)**

1. Go to Cloudflare Dashboard → R2
2. Select your `expo-ota-updates` bucket
3. Go to Settings → **Domain Access**
4. Click **Connect Domain**
5. Enter your custom domain (e.g., `updates.yourdomain.com`)
   - The domain must be on Cloudflare DNS
   - DNS will be automatically configured
6. Update `wrangler.toml` with your domain in the `BUCKET_URL` variable:
   ```toml
   BUCKET_URL = "https://updates.yourdomain.com"
   ```

**Option B: R2.dev Subdomain (For Testing/Development)**

1. Enable R2.dev subdomain:

   ```bash
   yarn exec wrangler -- r2 bucket domain enable expo-ota-updates
   ```

2. Get the public URL:

   ```bash
   yarn exec wrangler -- r2 bucket domain list expo-ota-updates
   ```

   This will output something like: `https://pub-abc123def456.r2.dev`

3. Update `wrangler.toml` with this URL in the `BUCKET_URL` variable:
   ```toml
   BUCKET_URL = "https://pub-abc123def456.r2.dev"
   ```

> [!WARNING]  
> R2.dev URLs are rate-limited and intended for testing only. Use a custom domain for production.

**7. Check wrangler.toml**

Ok so before we deploy, let's make sure everything looks correct in `wrangler.toml`

| Variable              | Required | Description                                                                                     |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `database_id`         | ✅       | Replace `YOUR_DATABASE_ID` with your D1 database ID from step 2                                 |
| `BUCKET_URL`          | ✅       | Replace with your R2 public URL from step 6 (custom domain or R2.dev subdomain)                 |
| `bucket_name`         | ❌       | Replace `expo-ota-updates` if you used a different bucket name                                  |
| `MAX_UPDATES_TO_KEEP` | ❌       | Number of updates to keep per channel/platform/runtime (set to 0 to keep all)                   |
| `ALLOWED_UPLOAD_IPS`  | ❌       | Comma-separated list of IP addresses allowed to upload builds (highly recommended for security) |

> [!NOTE]  
> When using ALLOWED_UPLOAD_IPS, be sure to add both your ipv4 and ipv6 addresses (if you use ipv6)

**8. Deployment**

Lastly, upload the worker to Cloudflare! If you ever change the .toml values you must redeploy the worker (or manually update them in Cloudflare).

```bash
# Deploy to Cloudflare Workers
yarn exec wrangler -- deploy
```

> [!NOTE]  
> If you are having issues use `yarn exec wrangler -- tail` to debug the worker logs when sending/downloading updates
