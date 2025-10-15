#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'index.ts');

// Detect if we're running in Bun
const isBun = typeof Bun !== 'undefined';

if (isBun) {
  // Bun natively supports TypeScript, just import directly
  await import(indexPath);
} else {
  // Node.js - use tsx loader with --env-file if .env exists
  const envPath = join(process.cwd(), '.env');
  const nodeArgs = ['--import', 'tsx'];

  // Add --env-file flag if .env exists in current directory
  if (existsSync(envPath)) {
    nodeArgs.push('--env-file', envPath);
  }

  nodeArgs.push(indexPath, ...process.argv.slice(2));

  const child = spawn('node', nodeArgs, { stdio: 'inherit' });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
