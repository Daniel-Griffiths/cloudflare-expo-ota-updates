#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxPath = require.resolve("tsx/esm");
const indexPath = join(__dirname, "..", "index.ts");

const envPath = join(process.cwd(), ".env");
const nodeArgs = ["--import", tsxPath];

if (existsSync(envPath)) {
  nodeArgs.push("--env-file", envPath);
}

nodeArgs.push(indexPath, ...process.argv.slice(2));

const child = spawn("node", nodeArgs, { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code || 0);
});
