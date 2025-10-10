import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("./migrations");

  return {
    test: {
      setupFiles: ["./src/test-setup.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.example.toml" },
          miniflare: {
            // Automatically uses D1 and R2 bindings from wrangler.example.toml
            bindings: {
              // Override ALLOWED_UPLOAD_IPS for tests to disable IP whitelist
              ALLOWED_UPLOAD_IPS: "",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
