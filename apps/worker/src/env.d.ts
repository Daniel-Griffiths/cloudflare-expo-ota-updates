import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BUCKET: R2Bucket;
      BUCKET_URL: string;
      MAX_UPDATES_TO_KEEP: string;
      ALLOWED_UPLOAD_IPS?: string;
      CODE_SIGNING_PRIVATE_KEY?: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
