#!/usr/bin/env node
/**
 * FridgeForage — FoodKeeper ETL
 * ------------------------------------------------------------------
 * Flattens the USDA FSIS FoodKeeper JSON into a denormalized
 * `shelf_life_rules` seed that the mobile app loads into SQLite at
 * first launch.
 *
 * The FoodKeeper file is NOT a flat table. It is a workbook of "sheets"
 * (Category, Cooking_Tips, Product, ...). Each sheet's `data` is an array
 * of rows, and each row is an array of single-key objects whose values are
 * sometimes scalars and sometimes 1-element arrays. Shelf life is spread
 * across ~20 columns (Refrigerate_Min/Max, DOP_Refrigerate_*, Pantry_*,
 * Freeze_*, *_Metric units) and the human-readable category lives in a
 * separate Category sheet keyed by Category_ID.
 *
 * This script normalizes all of that and emits ONE conservative
 * (shortest-safe) shelf-life number per zone, plus a default zone.
 *
 * Output (pick what your migration runner wants):
 *   - shelf_life_rules.sql   : portable INSERTs, run from your app's migrator
 *   - shelf_life_rules.json  : same data as JSON, if you prefer to seed in code
 *
 * Usage:
 *   1. Download the FoodKeeper JSON (the legacy fsis.usda.gov/shared/data
 *      URL is DEAD / 403). Get it from:
 *        https://www.fsis.usda.gov/science-data/data-sets-visualizations
 *        https://catalog.data.gov/dataset/fsis-foodkeeper-data
 *      Save it next to this script as `foodkeeper.json`.
 *   2. node build_shelf_life.mjs ./foodkeeper.json
 *
 * No dependencies. Node 18+.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "./foodkeeper.json");

// --- metric -> days multipliers (FoodKeeper uses these strings) ----------
const METRIC_DAYS = {
  Days: 1,
  Day: 1,
  Weeks: 7,
  Week: 7,
  Months: 30,
  Month: 30,
  Years: 365,
  Year: 365,
};

// Conservative ceilings (days) applied as a final safety net, mirroring the
// LLM-fallback clamps in app/safetyLimits.ts. Keyed by lowercased substring
// match against the category or product name.
const SAFETY_CEILINGS = [
  [/poultry|chicken|turkey|seafood|fish|shellfish|ground/, 2],
  [/beef|pork|lamb|veal|sausage|deli|berr|melon/, 5],
  [/leftover|cooked/, 4],
];

// ---- robust accessors for FoodKeeper's quirky shape ---------------------

/** Unwrap `x` or `[x]` -> x. */
function scalar(v) {
  return Array.isArray(v) ? v[0] : v;
}

/** A FoodKeeper "row" is an array of single-key objects; merge to one object. */
function rowToObject(row) {
  if (!Array.isArray(row)) return row && typeof row === "object" ? row : {};
  const out = {};
  for (const cell of row) {
    if (cell && typeof cell === "object") {
      for (const [k, v] of Object.entries(cell)) out[k] = scalar(v);
    }
  }
  return out;
}

/** Find a sheet by name across the two top-level shapes seen in the wild. */
function getSheet(root, name) {
  const container = Array.isArray(root) ? root[0] : root;
  const sheets = container?.sheets ?? [];
  const sheet = sheets.find((s) => s?.name === name);
  if (!sheet) return [];
  return (sheet.data ?? []).map(rowToObject).filter((o) => Object.keys(o).length);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Pick the conservative (shortest, non-null) duration in days from a set of
 * min/max field pairs. We deliberately prefer the MIN and the smallest pair.
 */
function conservativeDays(obj, fieldPairs) {
  const candidates = [];
  for (const [minF, maxF, metricF] of fieldPairs) {
    const mult = METRIC_DAYS[scalar(obj[metricF])] ?? 1;
    const lo = num(obj[minF]);
    const hi = num(obj[maxF]);
    if (lo != null) candidates.push(lo * mult);
    else if (hi != null) candidates.push(hi * mult); // fall back to max if no min
  }
  if (!candidates.length) return null;
  return Math.max(1, Math.round(Math.min(...candidates)));
}

function applyCeiling(name, category, days) {
  if (days == null) return null;
  const hay = `${name} ${category}`.toLowerCase();
  let capped = days;
  for (const [re, cap] of SAFETY_CEILINGS) {
    if (re.test(hay)) capped = Math.min(capped, cap);
  }
  return capped;
}

// ---- main ---------------------------------------------------------------

let root;
try {
  root = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (e) {
  console.error(`Could not read/parse ${inputPath}: ${e.message}`);
  console.error("Download foodkeeper.json from fsis.usda.gov first (see header).");
  process.exit(1);
}

const categories = getSheet(root, "Category");
const products = getSheet(root, "Product");

if (!products.length) {
  console.error("No Product rows found. The FoodKeeper schema may have changed.");
  console.error("Inspect the sheet names with: node -e \"...\" and adjust getSheet().");
  process.exit(1);
}

// Category_ID -> readable name
const categoryName = new Map();
for (const c of categories) {
  const id = num(c.ID ?? c.Category_ID);
  const name = c.Category_Name ?? c.Name;
  if (id != null && name) categoryName.set(id, String(name).trim());
}

const rules = [];
for (const p of products) {
  const id = num(p.ID);
  const baseName = [p.Name, p.Name_subtitle].filter(Boolean).join(" ").trim();
  if (id == null || !baseName) continue;
  const category = categoryName.get(num(p.Category_ID)) ?? "Uncategorized";

  // Refrigerate: prefer date-of-purchase (DOP) figures, then plain, then
  // after-opening as a last resort.
  const fridge = conservativeDays(p, [
    ["DOP_Refrigerate_Min", "DOP_Refrigerate_Max", "DOP_Refrigerate_Metric"],
    ["Refrigerate_Min", "Refrigerate_Max", "Refrigerate_Metric"],
    ["Refrigerate_After_Opening_Min", "Refrigerate_After_Opening_Max", "Refrigerate_After_Opening_Metric"],
  ]);
  const pantry = conservativeDays(p, [
    ["DOP_Pantry_Min", "DOP_Pantry_Max", "DOP_Pantry_Metric"],
    ["Pantry_Min", "Pantry_Max", "Pantry_Metric"],
    ["Pantry_After_Opening_Min", "Pantry_After_Opening_Max", "Pantry_After_Opening_Metric"],
  ]);
  const freezer = conservativeDays(p, [
    ["DOP_Freeze_Min", "DOP_Freeze_Max", "DOP_Freeze_Metric"],
    ["Freeze_Min", "Freeze_Max", "Freeze_Metric"],
  ]);

  if (fridge == null && pantry == null && freezer == null) continue;

  // Default zone: the shortest-lived applicable zone wins, because that is the
  // safety-relevant one to warn about. Ties prefer fridge.
  const zoneDays = [
    ["fridge", fridge],
    ["pantry", pantry],
    ["freezer", freezer],
  ].filter(([, d]) => d != null);
  zoneDays.sort((a, b) => a[1] - b[1]);
  const defaultZone = zoneDays[0][0];

  rules.push({
    id,
    category,
    name: baseName,
    name_lc: baseName.toLowerCase(),
    refrigerate_days: applyCeiling(baseName, category, fridge),
    pantry_days: pantry, // pantry/freezer items are shelf-stable; no perishable ceiling
    freeze_days: freezer,
    default_zone: defaultZone,
  });
}

console.log(`Parsed ${products.length} products -> ${rules.length} shelf-life rules.`);

// ---- emit SQL -----------------------------------------------------------
const esc = (s) => String(s).replace(/'/g, "''");
const sqlVal = (v) => (v == null ? "NULL" : typeof v === "number" ? v : `'${esc(v)}'`);

const ddl = `-- Generated by build_shelf_life.mjs. Do not edit by hand.
DROP TABLE IF EXISTS shelf_life_rules;
CREATE TABLE shelf_life_rules (
  id               INTEGER PRIMARY KEY,
  category         TEXT NOT NULL,
  name             TEXT NOT NULL,
  name_lc          TEXT NOT NULL,
  refrigerate_days INTEGER,
  pantry_days      INTEGER,
  freeze_days      INTEGER,
  default_zone     TEXT NOT NULL CHECK(default_zone IN ('fridge','pantry','freezer'))
);
CREATE INDEX idx_shelf_life_name_lc ON shelf_life_rules(name_lc);
`;

const inserts = rules
  .map(
    (r) =>
      `INSERT INTO shelf_life_rules VALUES (${[
        r.id,
        sqlVal(r.category),
        sqlVal(r.name),
        sqlVal(r.name_lc),
        sqlVal(r.refrigerate_days),
        sqlVal(r.pantry_days),
        sqlVal(r.freeze_days),
        sqlVal(r.default_zone),
      ].join(", ")});`
  )
  .join("\n");

writeFileSync("shelf_life_rules.sql", `${ddl}\nBEGIN TRANSACTION;\n${inserts}\nCOMMIT;\n`);
writeFileSync("shelf_life_rules.json", JSON.stringify(rules, null, 0));

console.log("Wrote shelf_life_rules.sql and shelf_life_rules.json");
