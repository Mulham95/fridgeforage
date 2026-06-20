// Safe web build wrapper. The Expo CLI reads .env directly during `expo export`,
// so it isn't enough to strip EXPO_PUBLIC_APP_SECRET from process.env — we have
// to filter the .env file on disk for the duration of the build. This script
// backs up .env, writes a filtered copy (no APP_SECRET line), runs the build,
// then unconditionally restores the original (even on crash, via try/finally).
//
// Without this guard the secret meant for mobile builds would be baked into the
// public web JS bundle.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";

const ENV = ".env";
const BACKUP = ".env.bak.build-web";
const STRIPPED = ["EXPO_PUBLIC_APP_SECRET"]; // never include these in web builds

let restored = false;
function restore() {
  if (restored) return;
  if (existsSync(BACKUP)) {
    copyFileSync(BACKUP, ENV);
    unlinkSync(BACKUP);
  }
  restored = true;
}

// Restore on any abnormal exit so we never leave a stripped .env behind.
process.on("SIGINT", () => { restore(); process.exit(130); });
process.on("SIGTERM", () => { restore(); process.exit(143); });

try {
  if (existsSync(ENV)) {
    copyFileSync(ENV, BACKUP);
    const filtered = readFileSync(ENV, "utf8")
      .split(/\r?\n/)
      .filter((line) => !STRIPPED.some((k) => new RegExp(`^\\s*${k}\\s*=`).test(line)))
      .join("\n");
    writeFileSync(ENV, filtered);
    console.log(`[build-web] filtered .env (stripped: ${STRIPPED.join(", ")})`);
  }

  const r = spawnSync(
    "npx",
    ["expo", "export", "-p", "web", "--output-dir", "dist", "--clear"],
    { stdio: "inherit", shell: true }
  );
  restore();
  process.exit(r.status ?? 1);
} catch (err) {
  console.error(err);
  restore();
  process.exit(1);
}
