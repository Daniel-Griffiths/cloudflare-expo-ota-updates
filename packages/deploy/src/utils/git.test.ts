import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";
import { getCommitHash, getShortCommitHash, isGitClean, getCurrentBranch } from "./git";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("Git utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCommitHash", () => {
    it("should return the commit hash when in a git repo", () => {
      const mockHash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0";
      vi.mocked(execSync).mockReturnValue(mockHash + "\n");

      expect(getCommitHash()).toBe(mockHash);
      expect(execSync).toHaveBeenCalledWith("git rev-parse HEAD", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    });

    it("should return undefined when not in a git repo", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(getCommitHash()).toBeUndefined();
    });

    it("should use custom working directory", () => {
      const mockHash = "abcdef123456";
      vi.mocked(execSync).mockReturnValue(mockHash);

      getCommitHash("/custom/path");
      expect(execSync).toHaveBeenCalledWith("git rev-parse HEAD", {
        cwd: "/custom/path",
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    });
  });

  describe("getShortCommitHash", () => {
    it("should return the first 7 characters of the commit hash", () => {
      const mockHash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0";
      vi.mocked(execSync).mockReturnValue(mockHash);

      expect(getShortCommitHash()).toBe("a1b2c3d");
    });

    it("should return undefined when not in a git repo", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(getShortCommitHash()).toBeUndefined();
    });
  });

  describe("isGitClean", () => {
    it("should return true when working directory is clean", () => {
      vi.mocked(execSync).mockReturnValue("");

      expect(isGitClean()).toBe(true);
      expect(execSync).toHaveBeenCalledWith("git status --porcelain", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    });

    it("should return false when there are uncommitted changes", () => {
      vi.mocked(execSync).mockReturnValue("M  file.txt\n");

      expect(isGitClean()).toBe(false);
    });

    it("should return false when not in a git repo", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(isGitClean()).toBe(false);
    });
  });

  describe("getCurrentBranch", () => {
    it("should return the current branch name", () => {
      vi.mocked(execSync).mockReturnValue("main\n");

      expect(getCurrentBranch()).toBe("main");
      expect(execSync).toHaveBeenCalledWith("git rev-parse --abbrev-ref HEAD", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    });

    it("should return undefined when not in a git repo", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(getCurrentBranch()).toBeUndefined();
    });
  });
});