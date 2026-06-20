# Build & install FridgeForage on your Android phone

Three stages: **(A)** deploy the AI proxy, **(B)** point the app at it, **(C)**
build the APK and install it. Stages A and the AI features are optional — the app
runs fully (barcode + local database + reminders) without them. The AI bits
(receipt scan, recipe generation) need the proxy.

Everything here runs on Windows. No Android Studio or Mac needed — EAS builds in
the cloud.

---

## 0. Test in your browser first (fastest)

Before touching the native build, run the whole app in a browser:

```bash
npm install
npm run web        # opens http://localhost:8081
```

On web, SQLite is replaced by a `localStorage` store and notifications are no-ops
(see `src/engine/*.web.ts`), so the full UI, pantry, add/edit, search, and recipe
flows all work. Add/receipt/recipe AI features need the proxy (stage A); barcode
scanning needs a real camera, so it's best tested on the phone.

---

## A. Deploy the Gemini proxy (Cloudflare Worker)

The proxy holds your Gemini API key so it never ships inside the app.

1. Create a free Cloudflare account: https://dash.cloudflare.com/sign-up
2. From the repo root:
   ```bash
   cd proxy
   npx wrangler login                       # opens a browser, authorize
   npx wrangler secret put GEMINI_API_KEY   # paste your Gemini key when prompted
   npx wrangler deploy
   ```
3. Wrangler prints a URL like
   `https://fridgeforage-ai.<your-subdomain>.workers.dev`. Copy it.
   - Optional hardening: `npx wrangler secret put APP_SHARED_SECRET` (any random
     string), then set `EXPO_PUBLIC_APP_SECRET` to the same value in step B.
4. Get a Gemini key (free tier): https://aistudio.google.com/apikey

## B. Point the app at the proxy

From the repo root:
```bash
cp .env.example .env
```
Edit `.env` and set the Worker URL:
```
EXPO_PUBLIC_FRIDGEFORAGE_API=https://fridgeforage-ai.<your-subdomain>.workers.dev
```
(`.env` is gitignored, so this stays off GitHub.)

## C. Build the installable APK with EAS

1. Create a free Expo account: https://expo.dev/signup
2. From the repo root:
   ```bash
   npm install -g eas-cli      # or: npx eas-cli@latest
   eas login
   eas build:configure         # links the project (accept defaults)
   eas build --platform android --profile preview
   ```
   The `preview` profile (already in `eas.json`) produces a standalone **APK**
   for sideloading. The build runs in Expo's cloud (~10–20 min); you can watch
   progress in the terminal or on https://expo.dev.
3. When it finishes, EAS gives you a **download link** and a QR code.
   - On your phone: open the link, download the `.apk`, tap it to install.
   - Android will ask you to allow "install from this source" the first time —
     allow it.
4. Open **FridgeForage**. Grant camera + notification permissions when asked.

### Iterating later
- JS-only change? `eas update` pushes it over-the-air (no rebuild) if you set up
  EAS Update, or just rebuild with the command above.
- Want it on the Play Store eventually? Use `--profile production` (builds an
  `.aab`) and `eas submit`.

### Prefer Android Studio? (instead of EAS cloud)
You can build the APK locally:
```bash
npx expo prebuild --platform android   # generates the native android/ project
```
Then open the generated **`android/`** folder in Android Studio and run
**Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)** (or `cd android && ./gradlew assembleRelease`).
Requires the Android SDK + JDK (Android Studio installs both). The config-plugin
permissions (camera, notifications) are applied automatically during prebuild.
Note: after prebuild the `android/` dir is committed/generated — re-run prebuild
after changing `app.json` plugins. EAS cloud is simpler if you'd rather not
install the SDK.

---

## D. Deploy the web version (optional)

The web build is a static SPA — host it anywhere. **Set the proxy URL first** so
AI features work in the deployed site:

```bash
# .env already has EXPO_PUBLIC_FRIDGEFORAGE_API=<your worker url>
npx expo export -p web        # outputs ./dist
```

Then deploy `dist/` to any static host. Cloudflare Pages pairs nicely (you're
already using Cloudflare for the proxy):

```bash
npx wrangler pages deploy dist --project-name fridgeforage
```

Or drag-and-drop `dist/` into Netlify, or `vercel deploy dist`, or push to a
`gh-pages` branch. Notes:
- Deployed sites are served over **HTTPS**, so the in-browser **camera works**
  (barcode + fridge scan) — unlike some `localhost` setups.
- On web, data lives in the browser's `localStorage` (per-device), and OS
  notifications are no-ops by design.
- The Worker already sends `Access-Control-Allow-Origin: *`, so the deployed page
  can call it.
- **Rebuild gotcha:** Metro caches the inlined `EXPO_PUBLIC_*` values. After
  changing `.env`, rebuild with `--clear` or the old URL stays baked in:
  `npx expo export -p web --output-dir dist --clear`.

### Hosting on workers.dev (when pages.dev is blocked)

Some networks/ISPs DNS-block `*.pages.dev` (e.g. it may resolve to `::1`). The
`*.workers.dev` domain is usually not blocked, so the build is also served from a
Worker via Cloudflare static assets (`web.wrangler.toml` + `web-worker.js`):

```bash
npm run deploy:web   # = expo export -p web --clear  &&  wrangler deploy --config web.wrangler.toml
```

Live at `https://fridgeforage-web.<subdomain>.workers.dev`. The AI proxy Worker
lives separately at `https://fridgeforage-ai.<subdomain>.workers.dev`.

---

## Using the full USDA FoodKeeper dataset (optional)

The app ships with a curated ~50-item shelf-life table so it works offline out of
the box. To use the complete USDA dataset:

1. Download `foodkeeper.json` from
   https://www.fsis.usda.gov/science-data/data-sets-visualizations (the old
   `fsis.usda.gov/shared/data/...` URL is dead) into `etl/`.
2. `npm run etl` → generates `etl/shelf_life_rules.sql`.
3. Paste its contents into `src/engine/seedData.ts` (replacing the curated SQL),
   or load it as a bundled asset. The schema matches exactly.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Recipe/receipt features do nothing | Proxy not deployed or `.env` URL wrong. Barcode + local lookup still work. |
| `eas build` can't find project | Run `eas build:configure` first. |
| Barcode scan opens black screen | Grant camera permission (Android Settings → Apps → FridgeForage → Permissions). |
| No expiry notifications | Grant notification permission; reminders fire 24h before expiry. |
