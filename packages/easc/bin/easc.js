#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'index.ts');

// Detect if we're running in Bun
const isBun = typeof Bun !== 'undefined';

if (isBun) {
  // Bun natively supports TypeScript, just import directly
  await import(indexPath);
} else {
  // Node.js - use tsx loader
  const child = spawn(
    'node',
    ['--import', 'tsx', indexPath, ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
