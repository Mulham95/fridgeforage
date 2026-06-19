/**
 * Local shelf-life lookup against the seeded FoodKeeper data.
 * This is the SOURCE OF TRUTH. The LLM is only consulted on a miss.
 */
import { getDb, type StorageZone } from "./db";

export interface ShelfLifeRule {
  id: number;
  category: string;
  name: string;
  refrigerate_days: number | null;
  pantry_days: number | null;
  freeze_days: number | null;
  default_zone: StorageZone;
}

export interface ShelfLifeMatch {
  days: number;
  zone: StorageZone;
  source: "foodkeeper";
  matchedName: string;
}

/**
 * Best-effort match of a normalized food name to a FoodKeeper rule.
 * Strategy: exact (lc) -> the rule whose name is the longest substring of the
 * query (so "Organic Whole Milk" matches "Milk"). Cheap and good enough; swap
 * for FTS5 if you want fuzzier matching.
 */
export async function lookupShelfLife(normalizedName: string): Promise<ShelfLifeMatch | null> {
  const db = await getDb();
  const q = normalizedName.trim().toLowerCase();
  if (!q) return null;

  // 1) exact
  let rule = await db.getFirstAsync<ShelfLifeRule>(
    "SELECT * FROM shelf_life_rules WHERE name_lc = ? LIMIT 1",
    q
  );

  // 2) rule name contained in the query, prefer the longest such name
  if (!rule) {
    rule = await db.getFirstAsync<ShelfLifeRule>(
      `SELECT * FROM shelf_life_rules
         WHERE ? LIKE '%' || name_lc || '%'
         ORDER BY LENGTH(name_lc) DESC
         LIMIT 1`,
      q
    );
  }

  // 3) query contained in a rule name (e.g. "milk" -> "Milk, whole")
  if (!rule) {
    rule = await db.getFirstAsync<ShelfLifeRule>(
      `SELECT * FROM shelf_life_rules
         WHERE name_lc LIKE '%' || ? || '%'
         ORDER BY LENGTH(name_lc) ASC
         LIMIT 1`,
      q
    );
  }

  if (!rule) return null;

  const zone = rule.default_zone;
  const days =
    zone === "fridge" ? rule.refrigerate_days
    : zone === "pantry" ? rule.pantry_days
    : rule.freeze_days;

  if (days == null) return null;
  return { days, zone, source: "foodkeeper", matchedName: rule.name };
}
