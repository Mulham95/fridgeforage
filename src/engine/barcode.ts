/**
 * Open Food Facts barcode lookup + the scan-to-pantry flow.
 *
 * Cost ladder (cheapest first):
 *   1. Open Food Facts  → clean product NAME from the scanned GTIN (free API).
 *   2. Local FoodKeeper → shelf life for that name (free, trusted, instant).
 *   3. AI fallback      → only if FoodKeeper has no match (clamped estimate).
 *
 * A barcode scan ideally never touches the LLM at all.
 *
 * OFF asks every client to send a descriptive User-Agent. Set a real contact.
 */
import { insertItems, type InventoryItem, type StorageZone } from "./db";
import { lookupShelfLife } from "./shelfLife";
import { aiInventoryIntake } from "./llm";
import { buildInventoryItem, toInventoryItem } from "./validation";
import { scheduleExpiryNotifications } from "./notifications";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT = "FridgeForage/1.0 (support@fridgeforage.app)";
const TIMEOUT_MS = 8_000;

export interface OffProduct {
  name: string;
  brands: string | null;
  categoriesTags: string[];
  gtin: string;
}

/** Look up a GTIN/UPC. Returns null if not found or on error (caller falls back). */
export async function lookupBarcode(gtin: string): Promise<OffProduct | null> {
  const code = gtin.replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(code)) return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${OFF_BASE}/${code}.json?fields=product_name,brands,categories_tags`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    // OFF returns status 1 when the product exists, 0 otherwise.
    if (data?.status !== 1 || !data?.product?.product_name) return null;
    return {
      name: String(data.product.product_name).trim(),
      brands: data.product.brands ? String(data.product.brands) : null,
      categoriesTags: Array.isArray(data.product.categories_tags) ? data.product.categories_tags : [],
      gtin: code,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface ScanOutcome {
  item: InventoryItem | null;
  source: "foodkeeper" | "model" | "not_found";
  productName: string | null;
}

/**
 * Full scan→pantry flow. Persists and schedules notifications on success.
 * If OFF can't identify the barcode, returns not_found so the UI can prompt the
 * user to type the name (which can then go through runIntake / manual add).
 */
export async function addScannedBarcode(gtin: string, quantity = 1): Promise<ScanOutcome> {
  const off = await lookupBarcode(gtin);
  if (!off) return { item: null, source: "not_found", productName: null };

  const now = Date.now();

  // 2) Trusted local shelf life for the resolved name.
  const match = await lookupShelfLife(off.name);
  if (match) {
    const item = buildInventoryItem(
      { name: off.name, quantity, zone: match.zone, days: match.days, gtin: off.gtin },
      now
    );
    await insertItems([item]);
    await scheduleExpiryNotifications();
    return { item, source: "foodkeeper", productName: off.name };
  }

  // 3) AI fallback — ask the model to estimate from just the resolved name.
  const ai = await aiInventoryIntake({ text: off.name });
  const raw = ai.items?.[0];
  const item = raw ? toInventoryItem({ ...(raw as object), barcode_gtin: off.gtin } as any, now) : null;
  if (item) {
    item.quantity = quantity > 0 ? quantity : item.quantity;
    await insertItems([item]);
    await scheduleExpiryNotifications();
    return { item, source: "model", productName: off.name };
  }

  return { item: null, source: "not_found", productName: off.name };
}
