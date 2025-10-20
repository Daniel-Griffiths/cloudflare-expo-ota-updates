import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  readAppJson,
  readMetadata,
  findBundleFile,
  getAssetFiles,
  checkDistDirectory,
} from "./files";

vi.mock("fs");
vi.mock("path");

describe("File utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
  });

  describe("readAppJson", () => {
    it("should read and parse app.json", () => {
      const mockAppJson = {
        expo: {
          name: "TestApp",
          version: "1.0.0",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockAppJson));

      const result = readAppJson("/test/dir");

      expect(fs.existsSync).toHaveBeenCalledWith("/test/dir/app.json");
      expect(fs.readFileSync).toHaveBeenCalledWith("/test/dir/app.json", "utf-8");
      expect(result).toEqual(mockAppJson);
    });

    it("should throw if app.json doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => readAppJson("/test/dir")).toThrow("app.json not found");
    });

    it("should throw if app.json is invalid JSON", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      expect(() => readAppJson("/test/dir")).toThrow("Failed to parse app.json");
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
  });

  describe("findBundleFile", () => {
    it("should find bundle file for platform", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "entry-abc123.hbc",
        "other-file.js",
      ] as any);

      const result = findBundleFile("/dist", "ios");

      expect(result).toBe("/dist/_expo/static/js/ios/entry-abc123.hbc");
    });

    it("should throw if bundle directory doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => findBundleFile("/dist", "android")).toThrow(
        "Bundle directory not found"
      );
    });

    it("should throw if no bundle files found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      expect(() => findBundleFile("/dist", "ios")).toThrow(
        "No bundle found for ios"
      );
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