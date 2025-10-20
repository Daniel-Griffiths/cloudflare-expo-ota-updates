import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateEnvironment,
  validateChannel,
  validateConfig,
  getConfig,
  validateServerUrl,
} from "./schema";

describe("Schema utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnvironment", () => {
    it("should pass when all environment variables are set", () => {
      process.env.OTA_SERVER = "https://example.com";
      process.env.OTA_API_KEY = "test-key";

      const result = validateEnvironment();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail when OTA_SERVER is missing", () => {
      delete process.env.OTA_SERVER;
      process.env.OTA_API_KEY = "test-key";

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("OTA_SERVER");
    });

    it("should fail when OTA_API_KEY is missing", () => {
      process.env.OTA_SERVER = "https://example.com";
      delete process.env.OTA_API_KEY;

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("OTA_API_KEY");
    });

    it("should fail when both are missing", () => {
      delete process.env.OTA_SERVER;
      delete process.env.OTA_API_KEY;

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should fail when OTA_SERVER is not a valid URL", () => {
      process.env.OTA_SERVER = "not-a-url";
      process.env.OTA_API_KEY = "test-key";

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("OTA_SERVER");
    });
  });

  describe("validateChannel", () => {
    it("should pass for valid channel names", () => {
      const validChannels = [
        "production",
        "staging",
        "dev",
        "test-123",
        "feature_branch",
      ];

      for (const channel of validChannels) {
        const result = validateChannel(channel);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it("should fail for undefined channel", () => {
      const result = validateChannel(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("--channel");
    });

    it("should fail for empty channel", () => {
      const result = validateChannel("");
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it("should fail for invalid channel names", () => {
      const invalidChannels = ["test@123", "feature/branch", "test.env"];

      for (const channel of invalidChannels) {
        const result = validateChannel(channel);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Invalid channel");
      }
    });
  });

  describe("validateConfig", () => {
    it("should pass when everything is valid", () => {
      process.env.OTA_SERVER = "https://example.com";
      process.env.OTA_API_KEY = "test-key";

      const result = validateConfig("production");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should combine all errors", () => {
      delete process.env.OTA_SERVER;
      delete process.env.OTA_API_KEY;

      const result = validateConfig(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // 2 env vars + 1 channel
    });
  });

  describe("getConfig", () => {
    it("should return config object", () => {
      process.env.OTA_SERVER = "https://example.com";
      process.env.OTA_API_KEY = "test-key";

      const config = getConfig("production");
      expect(config).toEqual({
        otaServer: "https://example.com",
        apiKey: "test-key",
        channel: "production",
      });
    });
  });

  describe("validateServerUrl", () => {
    it("should accept valid HTTP URLs", () => {
      expect(validateServerUrl("http://localhost:8787")).toBe(true);
      expect(validateServerUrl("https://example.com")).toBe(true);
      expect(validateServerUrl("https://api.example.com/path")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(validateServerUrl("not-a-url")).toBe(false);
      expect(validateServerUrl("ftp://example.com")).toBe(false);
      expect(validateServerUrl("")).toBe(false);
    });
  });
});
