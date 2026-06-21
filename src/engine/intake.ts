/**
 * Intake orchestration — the heart of the "feels fast, costs little, stays safe"
 * flow from the blueprint:
 *
 *   1. AI parses the raw input into normalized item names (this is the one thing
 *      only the model can do well — OCR cleanup + naming).
 *   2. For each item, try the LOCAL FoodKeeper DB first (free, instant, trusted).
 *   3. Only items with no local match keep the model's estimate — clamped by the
 *      food-safety limits.
 *   4. Everything is validated/coerced, persisted, and notifications scheduled.
 *
 * Why split it this way: parsing messy text is a model strength; shelf-life
 * numbers are a model *hazard*. So we let the model name things, but we override
 * its dates with USDA data whenever we can.
 */
import { insertItems, type InventoryItem, type StorageZone } from "./db";
import { aiInventoryIntake } from "./llm";
import { lookupShelfLife } from "./shelfLife";
import { toInventoryItem, buildInventoryItem } from "./validation";
import { clampShelfLife } from "./safetyLimits";
import { scheduleExpiryNotifications } from "./notifications";

export interface IntakeOutcome {
  items: InventoryItem[];
  status: "SUCCESS" | "PARTIAL" | "EMPTY";
  fromFoodKeeper: number;
  fromModel: number;
}

export async function runIntake(input: { text?: string; imageBase64?: string }): Promise<IntakeOutcome> {
  // allowFallback=true: transient AI failures (network, upstream) silently
  // return empty so the receipt-snap flow shows "Nothing found" instead of
  // crashing. Rate-limit errors still throw so the caller can show a clear
  // "wait a minute" message.
  const ai = await aiInventoryIntake(input, true);
  const now = Date.now();

  const items: InventoryItem[] = [];
  let fromFoodKeeper = 0;
  let fromModel = 0;

  for (const raw of ai.items) {
    const base = toInventoryItem(raw as any, now);
    if (!base) continue; // junk / no name

    // Prefer the trusted local database over the model's guessed shelf life.
    const match = await lookupShelfLife(base.normalized_name);
    if (match) {
      const days = clampShelfLife(base.normalized_name, match.zone, match.days);
      items.push({
        ...base,
        storage_zone: match.zone,
        estimated_shelf_life_days: days,
        expires_at: now + days * 86_400_000,
      });
      fromFoodKeeper++;
    } else {
      // No local match: keep the (already clamped) model estimate.
      items.push(base);
      fromModel++;
    }
  }

  if (items.length) {
    await insertItems(items);
    await scheduleExpiryNotifications();
  }

  return {
    items,
    status: items.length ? ai.processing_status : "EMPTY",
    fromFoodKeeper,
    fromModel,
  };
}

/**
 * Add a single item by typed name (manual entry).
 * Local FoodKeeper first; AI fallback only on a miss; safe default if offline.
 * `zoneOverride` lets the user correct the storage zone in the UI.
 */
export async function addByName(
  name: string,
  quantity = 1,
  zoneOverride?: StorageZone
): Promise<InventoryItem | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const now = Date.now();

  let item: InventoryItem | null = null;

  const match = await lookupShelfLife(trimmed);
  if (match) {
    item = buildInventoryItem(
      { name: trimmed, quantity, zone: zoneOverride ?? match.zone, days: match.days },
      now
    );
  } else {
    // Miss: try the model, then fall back to a conservative default.
    // allowFallback=true so AI outages don't block adding an item by name.
    const ai = await aiInventoryIntake({ text: trimmed }, true);
    const raw = ai.items?.[0];
    item = raw ? toInventoryItem({ ...(raw as object), quantity } as any, now) : null;
    if (!item) {
      item = buildInventoryItem(
        { name: trimmed, quantity, zone: zoneOverride ?? "fridge", days: 7 },
        now
      );
    } else if (zoneOverride) {
      item = { ...item, storage_zone: zoneOverride, quantity };
    }
  }

  if (item) {
    await insertItems([item]);
    await scheduleExpiryNotifications();
  }
  return item;
}
