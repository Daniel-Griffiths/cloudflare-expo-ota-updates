#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { createRequire } from "module";

const Runtime = {
  BUN: "bun",
  NODE: "node",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, "..", "index.ts");
const envPath = join(process.cwd(), ".env");
const envArgs = existsSync(envPath) ? ["--env-file", envPath] : [];
const scriptArgs = [indexPath, ...process.argv.slice(2)];

function getRuntime() {
  const runtime = !!process.versions["bun"] ? Runtime.BUN : Runtime.NODE;

  switch (runtime) {
    case Runtime.BUN:
      return { runtime, args: [...envArgs, ...scriptArgs] };
    case Runtime.NODE:
      const require = createRequire(import.meta.url);
      const tsxPath = require.resolve("tsx/esm");
      return {
        runtime,
        args: ["--import", tsxPath, ...envArgs, ...scriptArgs],
      };
  }
}

const { runtime, args } = getRuntime();

spawn(runtime, args, { stdio: "inherit" }).on("exit", (code) => {
  process.exit(code || 0);
});
