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

// Site metadata for LinkedIn / Twitter / Slack link previews. Edit here if the
// canonical URL changes — these get injected into dist/index.html after export.
const SITE_URL = "https://fridgeforage-web.fridgeforage-api.workers.dev";
const TITLE = "FridgeForage — fight food waste with your fridge";
const DESCRIPTION =
  "A smart ingredient-expiry tracker. Snap a photo of your fridge and get a recipe from what you have. Built with Expo, TypeScript, and Google Gemini.";
const OG_IMAGE = `${SITE_URL}/og.png`;
const THEME_COLOR = "#10B981";

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectMeta(htmlPath) {
  if (!existsSync(htmlPath)) {
    console.warn(`[build-web] ${htmlPath} not found; skipping meta injection`);
    return;
  }
  let html = readFileSync(htmlPath, "utf8");
  const t = escapeAttr(TITLE);
  const d = escapeAttr(DESCRIPTION);
  const u = escapeAttr(SITE_URL);
  const img = escapeAttr(OG_IMAGE);
  const tags = `
    <meta name="description" content="${d}" />
    <meta name="theme-color" content="${THEME_COLOR}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${u}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:site_name" content="FridgeForage" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />`;
  // Replace the bare <title>…</title> so LinkedIn shows our richer headline.
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);
  // Insert OG/twitter tags right before </head>, idempotently.
  if (!/property="og:title"/.test(html)) {
    html = html.replace(/<\/head>/i, `${tags}\n  </head>`);
  }
  writeFileSync(htmlPath, html);
  console.log("[build-web] injected meta + OG/Twitter tags into", htmlPath);
}

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
  if (r.status === 0) injectMeta("dist/index.html");
  process.exit(r.status ?? 1);
} catch (err) {
  console.error(err);
  restore();
  process.exit(1);
}
