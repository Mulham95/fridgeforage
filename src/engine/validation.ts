// Defensive coercion of untrusted model output: every field is coerced to satisfy
// the DB CHECK constraints, so an INSERT can never throw on a bad value.
import type { InventoryItem, StorageZone } from "./db";
import { clampShelfLife } from "./safetyLimits";

const ZONES: StorageZone[] = ["fridge", "pantry", "freezer"];
const UNITS = ["pcs", "bag", "box", "can", "bottle", "lbs", "oz", "g", "kg", "ml", "l", "bunch", "dozen"];

const UNIT_ALIASES: Record<string, string> = {
  lb: "lbs", pound: "lbs", pounds: "lbs",
  ounce: "oz", ounces: "oz",
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  milliliter: "ml", milliliters: "ml",
  liter: "l", litre: "l", liters: "l",
  piece: "pcs", pieces: "pcs", each: "pcs", ea: "pcs", unit: "pcs",
  bunches: "bunch", bottles: "bottle", cans: "can", boxes: "box", bags: "bag",
};

function coerceZone(raw: unknown): StorageZone {
  const v = String(raw ?? "").trim().toLowerCase();
  if ((ZONES as string[]).includes(v)) return v as StorageZone;
  // Soft mappings for common off-enum guesses.
  if (/freez/.test(v)) return "freezer";
  if (/pantr|cupboard|shelf|counter|dry/.test(v)) return "pantry";
  return "fridge"; // safest default for an unknown perishable
}

function coerceUnit(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (UNITS.includes(v)) return v;
  if (UNIT_ALIASES[v]) return UNIT_ALIASES[v];
  return "pcs";
}

function coerceQuantity(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1.0;
}

function coerceGtin(raw: unknown): string | null {
  if (raw == null) return null;
  const v = String(raw).replace(/\D/g, "");
  return /^\d{8,14}$/.test(v) ? v : null;
}

/** UUIDv4 without a dependency (uses global crypto, available in RN/Hermes). */
function uuid(): string {
  // @ts-ignore - crypto is provided by the RN runtime / expo-crypto polyfill
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface RawIntakeItem {
  normalized_name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  storage_zone?: unknown;
  estimated_shelf_life_days?: unknown;
  barcode_gtin?: unknown;
}

/**
 * Turn one raw model item into a DB-ready InventoryItem, or null if it's junk
 * (no usable name). `now` is injected for testability.
 */
export function toInventoryItem(raw: RawIntakeItem, now = Date.now()): InventoryItem | null {
  const name = String(raw.normalized_name ?? "").trim().slice(0, 80);
  if (!name) return null;

  const zone = coerceZone(raw.storage_zone);
  const shelfLife = clampShelfLife(name, zone, Number(raw.estimated_shelf_life_days));

  return {
    id: uuid(),
    normalized_name: name,
    quantity: coerceQuantity(raw.quantity),
    unit: coerceUnit(raw.unit),
    storage_zone: zone,
    estimated_shelf_life_days: shelfLife,
    barcode_gtin: coerceGtin(raw.barcode_gtin),
    added_at: now,
    expires_at: now + shelfLife * 86_400_000,
  };
}

export function toInventoryItems(rawItems: unknown, now = Date.now()): InventoryItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((r) => toInventoryItem(r as RawIntakeItem, now))
    .filter((x): x is InventoryItem => x !== null);
}

/**
 * Construct a DB-ready item from already-trusted fields (FoodKeeper hit),
 * still passing the shelf life through the safety clamp.
 */
export function buildInventoryItem(
  fields: { name: string; quantity?: number; unit?: string; zone: StorageZone; days: number; gtin?: string | null },
  now = Date.now()
): InventoryItem {
  const days = clampShelfLife(fields.name, fields.zone, fields.days);
  return {
    id: uuid(),
    normalized_name: fields.name.trim().slice(0, 80),
    quantity: fields.quantity && fields.quantity > 0 ? fields.quantity : 1.0,
    unit: fields.unit && UNITS.includes(fields.unit) ? fields.unit : "pcs",
    storage_zone: fields.zone,
    estimated_shelf_life_days: days,
    barcode_gtin: coerceGtin(fields.gtin),
    added_at: now,
    expires_at: now + days * 86_400_000,
  };
}
