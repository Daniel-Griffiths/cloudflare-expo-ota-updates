import { execSync } from "child_process";

/**
 * Get the current git commit hash
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns The commit hash or undefined if not in a git repo
 */
export function getCommitHash(cwd: string = process.cwd()): string | undefined {
  try {
    const hash = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return hash;
  } catch {
    return undefined;
  }
}

/**
 * Get the short version of the commit hash (7 characters)
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns The short commit hash or undefined if not in a git repo
 */
export function getShortCommitHash(cwd: string = process.cwd()): string | undefined {
  const hash = getCommitHash(cwd);
  return hash ? hash.substring(0, 7) : undefined;
}

/**
 * Check if the git working directory is clean
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns True if clean, false if there are uncommitted changes
 */
export function isGitClean(cwd: string = process.cwd()): boolean {
  try {
    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return status === "";
  } catch {
    return false;
  }
}

/**
 * Get the current git branch name
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns The branch name or undefined if not in a git repo
 */
export function getCurrentBranch(cwd: string = process.cwd()): string | undefined {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return branch;
  } catch {
    return undefined;
  }
}