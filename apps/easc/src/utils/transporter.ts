import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const TRANSPORTER_APP = "/Applications/Transporter.app";

/**
 * Window geometry of Transporter's main window, in screen points.
 */
export interface IWindowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the newest Active item's DELIVER button sits, relative to the window: the top row of
 * the Active list, ~174 pt below the window's origin, with the button ~683 pt to the right at
 * the default 840 pt window width (it scales horizontally with the window).
 * Transporter's list is not exposed to accessibility, so the button is clicked by position.
 */
export function deliverButtonPoint(frame: IWindowFrame): {
  x: number;
  y: number;
} {
  return {
    x: Math.round(frame.x + (683 * frame.width) / 840),
    y: Math.round(frame.y + 174),
  };
}

/**
 * Whether this machine can deliver through the Transporter app: macOS with the app installed.
 */
export function isTransporterAvailable(): boolean {
  return process.platform === "darwin" && fs.existsSync(TRANSPORTER_APP);
}

function osascript(script: string): string {
  return execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransporterRunning(): boolean {
  try {
    execFileSync("pgrep", ["-x", "Transporter"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deliver an .ipa to App Store Connect through the Transporter app — the same as dropping the
 * file on its window and pressing DELIVER, so it uses the Apple ID session Transporter is
 * already signed in with: no App Store Connect API key, no app-specific password, and no EAS
 * Submit queue. Requirements: macOS, Transporter installed and signed in, the Mac unlocked,
 * and accessibility access for the terminal running this (the click is synthesised).
 *
 * Transporter uploads asynchronously; this returns once the upload has been started, and the
 * artifact must stay on disk until Transporter has finished with it.
 */
export async function deliverWithTransporter(ipaPath: string): Promise<void> {
  if (!isTransporterAvailable()) {
    throw new Error(
      `Transporter is not installed at ${TRANSPORTER_APP} (macOS only).`,
    );
  }
  const ipa = path.resolve(ipaPath);
  if (!fs.existsSync(ipa)) throw new Error(`No such file: ${ipa}`);

  if (!isTransporterRunning()) {
    execFileSync("open", ["-a", "Transporter"]);
    await sleep(5000);
  }

  // A file-open event: identical to dropping the .ipa on the window.
  execFileSync("open", ["-a", "Transporter", ipa]);
  await sleep(8000); // Transporter reads the package and lists it under "Active"
  osascript('tell application "Transporter" to activate');
  await sleep(1000);

  const raw = osascript(
    'tell application "System Events" to tell process "Transporter" to get {position, size} of window 1',
  );
  const numbers = raw
    .replace(/[{}]/g, "")
    .split(",")
    .map((n) => Number(n.trim()));
  const [x, y, width, height] = numbers;
  if (
    numbers.length !== 4 ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    numbers.some(Number.isNaN)
  ) {
    throw new Error(
      `Could not read Transporter's window geometry (got "${raw}").`,
    );
  }
  const point = deliverButtonPoint({ x, y, width, height });
  osascript(
    `tell application "System Events" to tell process "Transporter" to click at {${point.x}, ${point.y}}`,
  );
}

export function transporterLogsDir(): string {
  return path.join(
    os.homedir(),
    "Library/Group Containers/group.com.apple.contentdelivery/Library/Logs/Transporter",
  );
}
