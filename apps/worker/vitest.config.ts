import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: path.join(__dirname, "wrangler.jsonc"),
        },
        miniflare: {
          bindings: {
            BUCKET_URL: "https://test.r2.dev",
            ALLOWED_UPLOAD_IPS: "",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: [path.join(__dirname, "src/test-setup.ts")],
    },
  };
});
