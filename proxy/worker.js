/**
 * FridgeForage AI proxy — Cloudflare Worker, Google Gemini backend.
 *
 * Why a proxy at all: the GEMINI_API_KEY must NEVER ship in the mobile binary
 * (it would be trivially extracted and abused). The app calls this Worker; the
 * Worker holds the key and talks to Gemini.
 *
 * Routes (POST, JSON):
 *   /v1/intake  { text?: string, imageBase64?: string }  -> intake JSON
 *   /v1/recipe  { expiring_items: string[], staples?: string[] } -> recipe JSON
 *
 * Secrets / vars (wrangler.toml + `wrangler secret put`):
 *   GEMINI_API_KEY     (secret)  — your Gemini key
 *   GEMINI_MODEL       (var)     — e.g. "gemini-2.5-flash" (set to current Flash)
 *   APP_SHARED_SECRET  (secret)  — optional; if set, app must send it as
 *                                  `x-app-secret` so randoms can't burn your quota
 *
 * Gemini REST shape used (verified June 2026):
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *   header x-goog-api-key: <key>
 *   body  { systemInstruction, contents, generationConfig:{responseMimeType, responseSchema} }
 *   reply candidates[0].content.parts[0].text  (a JSON string matching the schema)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Origins that are allowed to call the proxy from a browser. Set ALLOWED_ORIGINS
// in wrangler.toml (comma-separated). The mobile app sends no Origin header and
// is always allowed (those requests are gated by APP_SHARED_SECRET if set).
function parseAllowed(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowed) {
  const ok = !origin || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : allowed[0] || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-app-secret",
    "Vary": "Origin",
  };
}

const json = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });

// --- Per-IP rate limit using the Workers cache (no KV required) ------------
// Bucket per (IP, minute). Cache API stores GET responses keyed by URL within
// the colo; that's enough to bound abuse from any single client without paid
// rate-limiting. For real attack traffic add a Cloudflare WAF rule on top.
async function rateLimit(request, env) {
  const limit = Number(env.RATE_LIMIT_PER_MIN || 20);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bucket = Math.floor(Date.now() / 60_000);
  // Use the request's own origin so the key URL is valid + cacheable.
  const origin = new URL(request.url).origin;
  const key = new Request(`${origin}/__rl/${encodeURIComponent(ip)}/${bucket}`, {
    method: "GET",
  });
  const cache = caches.default;
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) || 0 : 0;
  if (count >= limit) return false;
  const res = new Response(String(count + 1), {
    headers: {
      // Cache-Control alone isn't enough — Cloudflare also needs Content-Type
      // and a finite max-age. 90s outlives the 60s bucket.
      "Cache-Control": "public, max-age=90",
      "Content-Type": "text/plain",
    },
  });
  await cache.put(key, res);
  return true;
}

// --- system prompt (keep in sync with prompt/system_prompt.md) -------------
const SYSTEM_PROMPT = `You are the FridgeForage data engine. You convert messy mobile inputs (receipt text, fridge-shelf photos, voice transcripts, typed lists) into structured records that match the provided JSON schema EXACTLY. Output JSON only — no prose, no markdown.

FOOD-SAFETY RULES (hard constraints):
1. You are a FALLBACK estimator; the app only calls you when its offline USDA FoodKeeper database has no match. Stay conservative.
2. estimated_shelf_life_days must be the SHORTEST SAFE duration, never optimistic. When unsure, round down.
3. Category ceilings regardless of brand/freshness claims:
   - Raw poultry, raw seafood, raw ground meat, fresh shellfish: max 2 days (fridge)
   - Raw whole-cut red meat, soft cheese, fresh berries, cut melon, deli meat: max 5 days (fridge)
   - Cooked leftovers: max 4 days (fridge)
   - Eggs in shell: max 35 days; hard cheese / root veg: max 21 days
   - Shelf-stable canned/dry goods: cap at 365
4. storage_zone is exactly one of: fridge, pantry, freezer (lowercase). Bias perishables toward fridge.
5. unit is one of: pcs, bag, box, can, bottle, lbs, oz, g, kg, ml, l, bunch, dozen.
6. quantity is a number; default 1.0 if absent.
7. Set barcode_gtin only if a GTIN/UPC is literally present, else null.

For receipts/photos: discard non-food line items (bags, totals, tax, loyalty points). Normalize abbreviations ("ORG CHKN BRST 1LB" -> "Organic Chicken Breast"). If nothing usable, return processing_status "EMPTY" and an empty items array.

For recipes: use ONLY the expiring items provided plus common staples; produce 4-8 short imperative steps; difficulty is Easy/Medium/Hard.`;

// --- Gemini response schemas (OpenAPI subset) ------------------------------
const UNIT_ENUM = ["pcs", "bag", "box", "can", "bottle", "lbs", "oz", "g", "kg", "ml", "l", "bunch", "dozen"];

const INTAKE_SCHEMA = {
  type: "object",
  properties: {
    processing_status: { type: "string", enum: ["SUCCESS", "PARTIAL", "EMPTY"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          normalized_name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", enum: UNIT_ENUM },
          storage_zone: { type: "string", enum: ["fridge", "pantry", "freezer"] },
          estimated_shelf_life_days: { type: "integer" },
          // Gemini represents nullable via a type array (NOT `nullable: true`).
          barcode_gtin: { type: ["string", "null"] },
        },
        required: ["normalized_name", "quantity", "unit", "storage_zone", "estimated_shelf_life_days"],
        propertyOrdering: ["normalized_name", "quantity", "unit", "storage_zone", "estimated_shelf_life_days", "barcode_gtin"],
      },
    },
  },
  required: ["processing_status", "items"],
  propertyOrdering: ["processing_status", "items"],
};

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    prep_time_minutes: { type: "integer" },
    cook_time_minutes: { type: "integer" },
    difficulty_rating: { type: "string", enum: ["Easy", "Medium", "Hard"] },
    expiring_items_utilized: { type: "array", items: { type: "string" } },
    common_pantry_staples_required: { type: "array", items: { type: "string" } },
    mobile_ui_steps: { type: "array", items: { type: "string" } },
  },
  required: [
    "title", "prep_time_minutes", "cook_time_minutes", "difficulty_rating",
    "expiring_items_utilized", "common_pantry_staples_required", "mobile_ui_steps",
  ],
  propertyOrdering: [
    "title", "prep_time_minutes", "cook_time_minutes", "difficulty_rating",
    "expiring_items_utilized", "common_pantry_staples_required", "mobile_ui_steps",
  ],
};

async function callGemini(env, parts, schema) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Gemini ${res.status}: ${detail.slice(0, 500)}`); // server log only
    throw new Error(`upstream_${res.status}`); // generic — never echoed to the client
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text); // schema-constrained, so this parses
}

export default {
  async fetch(request, env) {
    const allowed = parseAllowed(env);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);

    // Browser callers must come from an allow-listed origin.
    // Native/mobile requests send no Origin header — those bypass this and rely
    // on APP_SHARED_SECRET below.
    if (allowed.length && origin && !allowed.includes(origin)) {
      return json({ error: "origin not allowed" }, 403, cors);
    }

    // Optional shared-secret gate (recommended for mobile builds).
    if (env.APP_SHARED_SECRET && request.headers.get("x-app-secret") !== env.APP_SHARED_SECRET) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    // Per-IP rate limit — protects the Gemini bill from casual abuse.
    if (!(await rateLimit(request, env))) {
      return json({ error: "rate limited" }, 429, cors);
    }

    const url = new URL(request.url);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400, cors);
    }

    // Reject oversized image payloads (~6.7MB image as base64) to limit abuse/cost.
    if (typeof body.imageBase64 === "string" && body.imageBase64.length > 9_000_000) {
      return json({ error: "image too large" }, 413, cors);
    }

    try {
      if (url.pathname === "/v1/intake") {
        const parts = [];
        if (body.imageBase64) {
          parts.push({ text: "Extract the food items from this image." });
          parts.push({ inlineData: { mimeType: "image/jpeg", data: body.imageBase64 } });
        } else if (typeof body.text === "string" && body.text.trim()) {
          parts.push({ text: `Extract the food items from this input:\n${body.text.slice(0, 8000)}` });
        } else {
          return json({ processing_status: "EMPTY", items: [] }, 200, cors);
        }
        return json(await callGemini(env, parts, INTAKE_SCHEMA), 200, cors);
      }

      if (url.pathname === "/v1/recipe") {
        const items = Array.isArray(body.expiring_items) ? body.expiring_items : [];
        if (!items.length) return json({ error: "no expiring_items" }, 400, cors);
        const staples = Array.isArray(body.staples) ? body.staples : [];
        const prompt =
          `Expiring items to use up: ${items.join(", ")}.\n` +
          (staples.length ? `Assume these staples are available: ${staples.join(", ")}.` : "");
        return json(await callGemini(env, [{ text: prompt }], RECIPE_SCHEMA), 200, cors);
      }

      return json({ error: "not found" }, 404, cors);
    } catch (err) {
      console.error(err); // detail stays server-side (wrangler tail)
      return json({ error: "upstream error" }, 502, cors);
    }
  },
};
