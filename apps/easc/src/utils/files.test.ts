import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { Platform } from "../enums/platform";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
  checkDistDirectory,
} from "./files";

const { requireImpl } = vi.hoisted(() => ({
  requireImpl: vi.fn().mockImplementation(() => ({
    expo: { name: "FromConfigJs", version: "1.0.0" },
  })),
}));

vi.mock("fs");
vi.mock("path");
vi.mock("module", () => ({ createRequire: () => requireImpl }));

describe("File utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(path.resolve).mockImplementation((...args) => (args[0] as string) || "");
    requireImpl.mockImplementation(() => ({
      expo: { name: "FromConfigJs", version: "1.0.0" },
    }));
  });

  describe("readAppJson", () => {
    it("should read app.json when only app.json exists", () => {
      const mockAppJson = {
        expo: {
          name: "TestApp",
          version: "1.0.0",
        },
      };

      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) => typeof p === "string" && p.endsWith("app.json")
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockAppJson));

      const result = readAppJson("/test/dir");

      expect(fs.readFileSync).toHaveBeenCalledWith("/test/dir/app.json", "utf-8");
      expect(result).toEqual(mockAppJson);
    });

    it("should use app.config.js when it exists and not read app.json", () => {
      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) => typeof p === "string" && p.endsWith("app.config.js")
      );

      const result = readAppJson("/test/dir");

      expect((result as { expo: { name: string } }).expo.name).toBe("FromConfigJs");
      expect(result.expo.version).toBe("1.0.0");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should use app.config.ts when it exists and .js does not", () => {
      requireImpl.mockReturnValueOnce({
        expo: { name: "FromConfigTs", version: "1.0.0" },
      });
      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) => typeof p === "string" && p.endsWith("app.config.ts")
      );

      const result = readAppJson("/test/dir");

      expect((result as { expo: { name: string } }).expo.name).toBe("FromConfigTs");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should throw if no app config found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => readAppJson("/test/dir")).toThrow("No app config found");
    });

    it("should throw with cause when app.config.js fails to load", () => {
      requireImpl.mockImplementationOnce(() => {
        throw new Error("SyntaxError");
      });
      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) => typeof p === "string" && p.endsWith("app.config.js")
      );

      try {
        readAppJson("/test/dir");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Failed to load app.config.js/);
        expect((error as Error).cause).toBeDefined();
        expect((error as Error).cause).toBeInstanceOf(Error);
        expect(((error as Error).cause as Error).message).toBe("SyntaxError");
      }
    });

    it("should throw with cause when app.json is invalid JSON", () => {
      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) => typeof p === "string" && p.endsWith("app.json")
      );
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      try {
        readAppJson("/test/dir");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Failed to parse app.json/);
        expect((error as Error).cause).toBeDefined();
      }
    });
  });

  describe("readMetadata", () => {
    it("should read and parse metadata.json", () => {
      const mockMetadata = {
        fileMetadata: {
          ios: { assets: [] },
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockMetadata));

      const result = readMetadata("/test/dist");

      expect(fs.existsSync).toHaveBeenCalledWith("/test/dist/metadata.json");
      expect(result).toEqual(mockMetadata);
    });

    it("should throw if metadata.json doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => readMetadata("/test/dist")).toThrow(
        "metadata.json not found in /test/dist. Did you run 'expo export'?"
      );
    });

    it("should throw with cause when metadata.json is invalid JSON", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid");

      try {
        readMetadata("/test/dist");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Failed to parse metadata.json/);
        expect((error as Error).cause).toBeDefined();
      }
    });
  });

  describe("findBundleFile", () => {
    it("should find bundle file for platform (entry-*)", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "entry-abc123.hbc",
        "other-file.js",
      ] as any);

      const result = findBundleFile("/dist", Platform.iOS);

      expect(result).toBe("/dist/_expo/static/js/ios/entry-abc123.hbc");
    });

    it("should find bundle file for platform (index-*)", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "index-xyz789.hbc",
        "other-file.js",
      ] as any);

      const result = findBundleFile("/dist", Platform.Android);

      expect(result).toBe("/dist/_expo/static/js/android/index-xyz789.hbc");
    });

    it("should throw if bundle directory doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => findBundleFile("/dist", Platform.Android)).toThrow(
        "Bundle directory not found"
      );
    });

    it("should throw if no bundle files found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      expect(() => findBundleFile("/dist", Platform.iOS)).toThrow(
        "No bundle found for ios"
      );
    });

    it("should return first bundle alphabetically when multiple exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "index-a.hbc",
        "entry-b.hbc",
      ] as any);

      const result = findBundleFile("/dist", Platform.iOS);

      expect(result).toBe("/dist/_expo/static/js/ios/entry-b.hbc");
    });

    it("should not mutate the array returned by readdirSync", () => {
      const files = ["index-x.hbc", "entry-y.hbc"];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(files as any);

      findBundleFile("/dist", Platform.Android);

      expect(files).toEqual(["index-x.hbc", "entry-y.hbc"]);
    });
  });

  describe("checkDistDirectory", () => {
    it("should return dist dir when valid", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = checkDistDirectory("/test");

      expect(result).toBe("/test/dist");
    });

    it("should throw if dist directory doesn't exist", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path !== "/test/dist";
      });

      expect(() => checkDistDirectory("/test")).toThrow(
        "Export directory not found"
      );
    });
  });
});