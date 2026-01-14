import { execSync, ExecSyncOptions } from "child_process";

declare const Bun: unknown;

/**
 * Execute a command using the appropriate package runner (bunx or npx)
 * based on the current runtime environment.
 */
export function runx(
  command: string,
  options?: ExecSyncOptions
): Buffer | string {
  const isBun = typeof Bun !== "undefined";
  const packageRunner = isBun ? "bunx" : "npx";

  return execSync(`${packageRunner} ${command}`, options);
}
