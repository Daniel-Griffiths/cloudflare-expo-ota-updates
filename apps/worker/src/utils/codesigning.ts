const cache = { key: null as CryptoKey | null, pem: null as string | null };

/**
 * Parses a PEM-encoded PKCS#8 private key into a CryptoKey for RSA-SHA256 signing.
 *
 * @param pem PEM-encoded private key string
 * @returns CryptoKey ready for signing
 */
export async function parsePemPrivateKey(pem: string): Promise<CryptoKey> {
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error(
      "PKCS#1 format (BEGIN RSA PRIVATE KEY) is not supported. " +
        "Please use PKCS#8 format (BEGIN PRIVATE KEY). " +
        "The expo-updates codesigning:generate command produces the correct format.",
    );
  }

  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const derBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    derBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Signs a JSON body string with an RSA private key and returns
 * the Expo SFV-formatted signature string.
 *
 * @param privateKey CryptoKey for signing
 * @param jsonBody The exact JSON string to sign
 * @returns Expo SFV signature string: sig="<base64>", keyid="main"
 */
export async function signBody(privateKey: CryptoKey, jsonBody: string): Promise<string> {
  const bodyBytes = new TextEncoder().encode(jsonBody);
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, bodyBytes);
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return `sig="${base64Signature}", keyid="main"`;
}

/**
 * Signs a JSON body if a private key is available. Caches the parsed
 * CryptoKey across requests within the same isolate.
 *
 * @param pemKey PEM-encoded private key
 * @param jsonBody The exact JSON string to sign
 * @returns Expo SFV signature string
 */
export async function getSignature(pemKey: string, jsonBody: string): Promise<string> {
  if (!cache.key || cache.pem !== pemKey) {
    cache.key = await parsePemPrivateKey(pemKey);
    cache.pem = pemKey;
  }

  return signBody(cache.key, jsonBody);
}
