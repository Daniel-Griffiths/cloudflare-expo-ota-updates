import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { Platform } from "../enums/platform";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
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
    vi.mocked(path.resolve).mockImplementation((...args) => args[0] ?? "");
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

      expect(result.expo.name).toBe("FromConfigJs");
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

      expect(result.expo.name).toBe("FromConfigTs");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should use app.config.ts over app.config.js when both exist", () => {
      requireImpl.mockReturnValueOnce({
        expo: { name: "FromConfigTs", version: "1.0.0" },
      });
      vi.mocked(fs.existsSync).mockImplementation(
        (p: fs.PathLike) =>
          typeof p === "string" &&
          (p.endsWith("app.config.js") || p.endsWith("app.config.ts"))
      );

      const result = readAppJson("/test/dir");

      expect(result.expo.name).toBe("FromConfigTs");
      expect(requireImpl).toHaveBeenCalledWith("/test/dir/app.config.ts");
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
        if (!(error instanceof Error)) throw error;
        expect(error.message).toMatch(/Failed to load app.config.js/);
        expect(error.cause).toBeDefined();
        expect(error.cause).toBeInstanceOf(Error);
        if (!(error.cause instanceof Error)) throw error;
        expect(error.cause.message).toBe("SyntaxError");
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
        if (!(error instanceof Error)) throw error;
        expect(error.message).toMatch(/Failed to load app.json/);
        expect(error.cause).toBeDefined();
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
        if (!(error instanceof Error)) throw error;
        expect(error.message).toMatch(/Failed to parse metadata.json/);
        expect(error.cause).toBeDefined();
      }
    });
  });

  describe("findBundleFile", () => {
    it("should return correct path from metadata bundle field", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const metadata = {
        version: 0,
        bundler: "metro",
        fileMetadata: {
          [Platform.iOS]: {
            bundle: "_expo/static/js/ios/entry-abc123.hbc",
            assets: [],
          },
        },
      };

      const result = findBundleFile("/dist", metadata, Platform.iOS);

      expect(result).toBe("/dist/_expo/static/js/ios/entry-abc123.hbc");
    });

    it("should work for android platform", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const metadata = {
        version: 0,
        bundler: "metro",
        fileMetadata: {
          [Platform.Android]: {
            bundle: "_expo/static/js/android/index-xyz789.js",
            assets: [],
          },
        },
      };

      const result = findBundleFile("/dist", metadata, Platform.Android);

      expect(result).toBe("/dist/_expo/static/js/android/index-xyz789.js");
    });

    it("should throw if platform not in metadata", () => {
      const metadata = {
        version: 0,
        bundler: "metro",
        fileMetadata: {
          [Platform.iOS]: {
            bundle: "_expo/static/js/ios/entry-abc123.hbc",
            assets: [],
          },
        },
      };

      expect(() => findBundleFile("/dist", metadata, Platform.Android)).toThrow(
        "No bundle path found for android in metadata.json"
      );
    });

    it("should throw if fileMetadata is missing", () => {
      const metadata = { version: 0, bundler: "metro" };

      expect(() => findBundleFile("/dist", metadata, Platform.iOS)).toThrow(
        "No bundle path found for ios in metadata.json"
      );
    });

    it("should throw if bundle file doesn't exist on disk", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const metadata = {
        version: 0,
        bundler: "metro",
        fileMetadata: {
          [Platform.iOS]: {
            bundle: "_expo/static/js/ios/entry-abc123.hbc",
            assets: [],
          },
        },
      };

      expect(() => findBundleFile("/dist", metadata, Platform.iOS)).toThrow(
        "Bundle file not found"
      );
    });
  });

});