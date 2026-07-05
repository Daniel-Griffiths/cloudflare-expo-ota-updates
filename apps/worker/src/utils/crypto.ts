/**
 * Computes a hash of a file and returns it in the specified encoding.
 *
 * The expo-updates protocol uses two different hashes per asset: `hash` is
 * SHA-256 (base64url), while `key` must be the MD5 hex hash — the same value
 * Metro uses in the JS asset registry, which the client uses to look up
 * downloaded assets at runtime. MD5 is a non-standard extension supported by
 * Cloudflare Workers' crypto.subtle.
 *
 * @param buffer ArrayBuffer of the file
 * @param encoding  Encoding type: "base64" or "hex"
 * @param algorithm Digest algorithm, defaults to "SHA-256"
 * @returns Hash of the file in the specified encoding
 */
export async function computeFileHash(
  buffer: ArrayBuffer,
  encoding: "base64" | "hex",
  algorithm: "SHA-256" | "MD5" = "SHA-256",
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);

  switch (encoding) {
    case "base64": {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }
    case "hex": {
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    default: {
      throw new Error(`Unsupported encoding: ${String(encoding)}`);
    }
  }
}
