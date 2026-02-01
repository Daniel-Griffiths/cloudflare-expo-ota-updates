import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));

  return {
    test: {
      setupFiles: [path.join(__dirname, "src/test-setup.ts")],
      poolOptions: {
        workers: {
          wrangler: {
            configPath: path.join(__dirname, "wrangler.toml"),
          },
          miniflare: {
            // Automatically uses D1 and R2 bindings from wrangler.toml
            bindings: {
              BUCKET_URL: "https://test.r2.dev",
              ALLOWED_UPLOAD_IPS: "",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
