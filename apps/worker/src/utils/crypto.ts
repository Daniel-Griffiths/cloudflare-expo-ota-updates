/**
 * Computes the SHA-256 hash of a file and returns it in the specified encoding.
 *
 * @param buffer ArrayBuffer of the file
 * @param encoding  Encoding type: "base64" or "hex"
 * @returns SHA-256 hash of the file in the specified encoding
 */
export async function computeFileHash(
  buffer: ArrayBuffer,
  encoding: "base64" | "hex"
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);

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
      throw new Error(`Unsupported encoding: ${encoding}`);
    }
  }
}
