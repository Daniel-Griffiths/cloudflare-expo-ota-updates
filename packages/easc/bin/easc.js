#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, "..", "index.ts");

const envPath = join(process.cwd(), ".env");
const nodeArgs = ["--import", "tsx/esm"];

if (existsSync(envPath)) {
  nodeArgs.push("--env-file", envPath);
}

nodeArgs.push(indexPath, ...process.argv.slice(2));

const child = spawn("node", nodeArgs, { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code || 0);
});
