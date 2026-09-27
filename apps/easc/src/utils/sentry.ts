import { runx } from "./runx";

const SOURCE_MAP_EXTENSION = ".map";

/**
 * Whether a SENTRY_AUTH_TOKEN is set (usually from the app's .env).
 */
export function hasSentryAuthToken(): boolean {
  return Boolean(process.env["SENTRY_AUTH_TOKEN"]);
}

/**
 * Upload the export's bundles and source maps to Sentry. They are matched to
 * events by the debug ID Sentry's Metro config injects, so every OTA update of
 * the same app version symbolicates on its own. Org and project come from the
 * `@sentry/react-native/expo` plugin entry in the app config.
 */
export function uploadSourceMapsToSentry(exportDir: string): void {
  runx(`sentry-expo-upload-sourcemaps ${exportDir}`, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

/**
 * Throw if any file about to be published to the update server is a source map.
 */
export function assertNoSourceMaps(filePaths: string[]): void {
  const sourceMaps = filePaths.filter((file) => file.endsWith(SOURCE_MAP_EXTENSION));
  if (sourceMaps.length > 0) {
    throw new Error(
      `Refusing to publish source maps to the update server:\n  ${sourceMaps.join("\n  ")}`,
    );
  }
}
