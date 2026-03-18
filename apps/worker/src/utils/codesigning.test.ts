import { describe, it, expect, beforeAll } from "vitest";
import { parsePemPrivateKey, signBody, getSignature } from "./codesigning";

/**
 * Generate a test RSA key pair at runtime to avoid committing
 * private key material to the repository.
 */
async function generateTestKey(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  if (!("privateKey" in keyPair)) {
    throw new Error("Expected a CryptoKeyPair");
  }

  const exported = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  if (!(exported instanceof ArrayBuffer)) {
    throw new Error("Expected an ArrayBuffer");
  }

  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  const lines = base64.match(/.{1,64}/g) || [];

  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

let TEST_PRIVATE_KEY: string;

beforeAll(async () => {
  TEST_PRIVATE_KEY = await generateTestKey();
});

describe("Code Signing", () => {
  describe("parsePemPrivateKey", () => {
    it("should parse a valid PKCS#8 PEM key", async () => {
      const key = await parsePemPrivateKey(TEST_PRIVATE_KEY);
      expect(key).toBeDefined();
      expect(key.type).toBe("private");
      expect(key.algorithm).toMatchObject({ name: "RSASSA-PKCS1-v1_5" });
    });

    it("should reject PKCS#1 format keys", async () => {
      const pkcs1Key = TEST_PRIVATE_KEY.replace(
        "BEGIN PRIVATE KEY",
        "BEGIN RSA PRIVATE KEY",
      ).replace("END PRIVATE KEY", "END RSA PRIVATE KEY");

      await expect(parsePemPrivateKey(pkcs1Key)).rejects.toThrow("PKCS#1");
    });

    it("should reject invalid PEM data", async () => {
      await expect(parsePemPrivateKey("not a pem key")).rejects.toThrow();
    });
  });

  describe("signBody", () => {
    it("should return a correctly formatted Expo SFV signature", async () => {
      const key = await parsePemPrivateKey(TEST_PRIVATE_KEY);
      const signature = await signBody(key, '{"test":"data"}');

      expect(signature).toMatch(/^sig="[A-Za-z0-9+/=]+", keyid="main"$/);
    });

    it("should produce different signatures for different bodies", async () => {
      const key = await parsePemPrivateKey(TEST_PRIVATE_KEY);
      const sig1 = await signBody(key, '{"a":1}');
      const sig2 = await signBody(key, '{"b":2}');

      expect(sig1).not.toBe(sig2);
    });

    it("should produce the same signature for the same body", async () => {
      const key = await parsePemPrivateKey(TEST_PRIVATE_KEY);
      const sig1 = await signBody(key, '{"a":1}');
      const sig2 = await signBody(key, '{"a":1}');

      expect(sig1).toBe(sig2);
    });
  });

  describe("getSignature", () => {
    it("should return a signature string", async () => {
      const signature = await getSignature(TEST_PRIVATE_KEY, '{"test":"data"}');

      expect(signature).toMatch(/^sig="[A-Za-z0-9+/=]+", keyid="main"$/);
    });
  });
});
