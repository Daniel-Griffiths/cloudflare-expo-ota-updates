import { describe, it, expect } from "vitest";
import { resolveRuntimeVersion, getPlatforms, type AppJson } from "./runtime";

describe("resolveRuntimeVersion", () => {
  it("should return string runtime version directly", () => {
    const appJson: AppJson = {
      expo: {
        runtimeVersion: "1.0.0",
      },
    };
    expect(resolveRuntimeVersion(appJson)).toBe("1.0.0");
  });

  it("should resolve appVersion policy", () => {
    const appJson: AppJson = {
      expo: {
        runtimeVersion: { policy: "appVersion" },
        version: "2.1.0",
      },
    };
    expect(resolveRuntimeVersion(appJson)).toBe("2.1.0");
  });

  it("should throw error when appVersion policy is used but version is missing", () => {
    const appJson: AppJson = {
      expo: {
        runtimeVersion: { policy: "appVersion" },
      },
    };
    expect(() => resolveRuntimeVersion(appJson)).toThrow(
      'runtimeVersion policy is "appVersion" but no version field found in app.json'
    );
  });

  it("should throw error for invalid runtime version configuration", () => {
    const appJson: AppJson = {
      expo: {},
    };
    expect(() => resolveRuntimeVersion(appJson)).toThrow(
      "Invalid runtimeVersion configuration"
    );
  });

  it("should throw error for unsupported policy", () => {
    const appJson: AppJson = {
      expo: {
        runtimeVersion: { policy: "unsupported" } as any,
      },
    };
    expect(() => resolveRuntimeVersion(appJson)).toThrow(
      "Invalid runtimeVersion configuration"
    );
  });
});

describe("getPlatforms", () => {
  it("should return specified platforms", () => {
    const appJson: AppJson = {
      expo: {
        platforms: ["ios", "android"],
      },
    };
    expect(getPlatforms(appJson)).toEqual(["ios", "android"]);
  });

  it("should default to both platforms when not specified", () => {
    const appJson: AppJson = {
      expo: {},
    };
    expect(getPlatforms(appJson)).toEqual(["ios", "android"]);
  });

  it("should filter out invalid platforms", () => {
    const appJson: AppJson = {
      expo: {
        platforms: ["ios", "web", "android"],
      },
    };
    expect(getPlatforms(appJson)).toEqual(["ios", "android"]);
  });

  it("should handle iOS-only", () => {
    const appJson: AppJson = {
      expo: {
        platforms: ["ios"],
      },
    };
    expect(getPlatforms(appJson)).toEqual(["ios"]);
  });

  it("should handle Android-only", () => {
    const appJson: AppJson = {
      expo: {
        platforms: ["android"],
      },
    };
    expect(getPlatforms(appJson)).toEqual(["android"]);
  });
});