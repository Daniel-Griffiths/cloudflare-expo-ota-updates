import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { hasSentryAuthToken, assertNoSourceMaps } from "./sentry";

describe("Sentry utilities", () => {
  describe("hasSentryAuthToken", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("is true when SENTRY_AUTH_TOKEN is set", () => {
      vi.stubEnv("SENTRY_AUTH_TOKEN", "sntrys_test");

      expect(hasSentryAuthToken()).toBe(true);
    });

    it("is false when SENTRY_AUTH_TOKEN is empty", () => {
      vi.stubEnv("SENTRY_AUTH_TOKEN", "");

      expect(hasSentryAuthToken()).toBe(false);
    });
  });

  describe("assertNoSourceMaps", () => {
    it("passes when no file is a source map", () => {
      expect(() =>
        assertNoSourceMaps(["dist/_expo/static/js/ios/entry-abc.hbc", "dist/assets/0f1e2d"]),
      ).not.toThrow();
    });

    it("throws when a source map would be published", () => {
      expect(() =>
        assertNoSourceMaps([
          "dist/_expo/static/js/ios/entry-abc.hbc",
          "dist/_expo/static/js/ios/entry-abc.hbc.map",
        ]),
      ).toThrow(/entry-abc\.hbc\.map/);
    });
  });
});
