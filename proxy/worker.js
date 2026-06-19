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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-app-secret",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

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
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text); // schema-constrained, so this parses
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);

    // Optional shared-secret gate.
    if (env.APP_SHARED_SECRET && request.headers.get("x-app-secret") !== env.APP_SHARED_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    const url = new URL(request.url);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400);
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
          return json({ processing_status: "EMPTY", items: [] });
        }
        return json(await callGemini(env, parts, INTAKE_SCHEMA));
      }

      if (url.pathname === "/v1/recipe") {
        const items = Array.isArray(body.expiring_items) ? body.expiring_items : [];
        if (!items.length) return json({ error: "no expiring_items" }, 400);
        const staples = Array.isArray(body.staples) ? body.staples : [];
        const prompt =
          `Expiring items to use up: ${items.join(", ")}.\n` +
          (staples.length ? `Assume these staples are available: ${staples.join(", ")}.` : "");
        return json(await callGemini(env, [{ text: prompt }], RECIPE_SCHEMA));
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      // Fail soft: the client treats a non-2xx / empty as "offline" and shows a manual path.
      return json({ error: String(err.message || err) }, 502);
    }
  },
};
