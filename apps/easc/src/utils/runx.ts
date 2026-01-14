import { execSync, ExecSyncOptions } from "child_process";

/**
 * Execute a command using the appropriate package runner (bunx or npx)
 * based on the current runtime environment.
 */
export function runx(
  command: string,
  options?: ExecSyncOptions
): Buffer | string {
  const packageRunner = !!process.versions["bun"] ? "bunx" : "npx";

  return execSync(`${packageRunner} ${command}`, options);
}
