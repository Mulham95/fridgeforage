# Security review

Pre-deployment review of FridgeForage. Scope: the mobile/web client, the local
data layer, and the Cloudflare Worker proxy.

## Summary

| Area | Status |
|---|---|
| Secrets in repo | ✅ None. `.env` is gitignored and absent from history; no hardcoded keys. |
| API key exposure | ✅ The Gemini key lives only in the Cloudflare Worker, never in the app bundle. |
| Network | ✅ All requests are HTTPS (Open Food Facts, the proxy). |
| Untrusted AI output | ✅ Every model field is coerced/validated client-side before it can touch SQLite (`validation.ts`), and shelf-life values are clamped (`safetyLimits.ts`). |
| Permissions | ✅ Minimal — camera and notifications only. |
| Dependency CVEs (runtime) | ✅ None shipped in the app bundle. |
| Dependency CVEs (build tooling) | 🟡 11 moderate, all in dev-only Expo CLI tooling (not shipped). See below. |

## Fixes applied in this review

- **Removed `@expo/webpack-config`** — a deprecated, unused dev dependency that
  was pulling in the only **high-severity** advisories (braces, ansi-html,
  cacache, chokidar). The project uses the Metro web bundler.
- **Worker no longer leaks upstream errors** — Gemini error text is logged
  server-side (`wrangler tail`) and the client receives only a generic message.
- **Worker rejects oversized image payloads** (HTTP 413 over ~6.7 MB) to limit
  abuse and cost. Text input was already capped at 8 000 chars.

## Remaining dependency advisories (accepted)

The 11 moderate advisories are all transitive under `expo` / `@expo/cli` /
`@expo/config` — **build-time CLI tooling that never ends up in the shipped app
or the deployed web bundle.** They cannot be resolved without downgrading Expo
SDK 56 (which `npm audit fix --force` would attempt and break). Re-evaluate when
Expo ships patched tooling. Not a runtime risk.

## Before you deploy publicly — do these

The proxy is the one internet-facing component. A public web build can't keep a
secret (anything in the JS bundle is visible), so protect the **proxy and the
Gemini key**, not the client:

1. **Set a hard spend/quota cap on the Gemini key** (Google AI Studio / Cloud
   billing). This is the single most important control — it bounds worst-case
   cost if the proxy URL is abused.
2. **Add a Cloudflare rate-limiting rule** on the Worker route (e.g. N requests
   per IP per minute). Free tier supports basic rate limiting.
3. **Set `APP_SHARED_SECRET`** (`wrangler secret put APP_SHARED_SECRET`). This
   meaningfully protects the **mobile** app (the secret sits in the binary). For
   the **web** build it's only light friction, since it ships in the bundle —
   rely on (1) and (2) there.
4. **Privacy note:** receipt and fridge photos can contain personal information
   and are sent to Google Gemini via the proxy for analysis. Say so in a short
   privacy notice before publishing.

## Notes

- On web, app data lives in the browser's `localStorage` (no secrets, per-device).
- Prompt-injection surface is low: the system prompt is fixed server-side, output
  is schema-constrained, and the client re-validates — a crafted photo/receipt
  can at worst produce odd food data, never escape the schema or reach the device.
