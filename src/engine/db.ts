/**
 * SQLite setup for FridgeForage (expo-sqlite, new async API).
 *
 * Two logical tables:
 *  - shelf_life_rules : read-only reference data, seeded from the FoodKeeper ETL
 *    (etl/build_shelf_life.mjs -> shelf_life_rules.sql). Ship the .sql as a
 *    bundled asset and run it once on first launch.
 *  - inventory_items  : the user's pantry. `expires_at` is computed at insert
 *    time so notifications and the "expiring soon" query share one timestamp.
 */
import * as SQLite from "expo-sqlite";

export type StorageZone = "fridge" | "pantry" | "freezer";

export interface InventoryItem {
  id: string; // UUIDv4, minted on the client
  normalized_name: string;
  quantity: number;
  unit: string;
  storage_zone: StorageZone;
  estimated_shelf_life_days: number;
  barcode_gtin: string | null;
  added_at: number; // epoch ms
  expires_at: number; // epoch ms = added_at + shelf_life_days * 86400_000
}

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("fridgeforage.db");
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS inventory_items (
      id                        TEXT PRIMARY KEY NOT NULL,
      normalized_name           TEXT NOT NULL,
      quantity                  REAL NOT NULL DEFAULT 1.0,
      unit                      TEXT NOT NULL DEFAULT 'pcs',
      storage_zone              TEXT NOT NULL CHECK(storage_zone IN ('fridge','pantry','freezer')),
      estimated_shelf_life_days INTEGER NOT NULL,
      barcode_gtin              TEXT,
      added_at                  INTEGER NOT NULL,
      expires_at                INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_expires ON inventory_items(expires_at);
  `);
  return _db;
}

/**
 * Seed the reference table once. `seedSql` is the contents of the bundled
 * shelf_life_rules.sql asset (load it via expo-asset / FileSystem).
 */
export async function ensureShelfLifeSeeded(seedSql: string): Promise<void> {
  const db = await getDb();
  const seeded = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='shelf_life_rules'"
  );
  if (seeded && seeded.c > 0) {
    const rows = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM shelf_life_rules");
    if (rows && rows.c > 0) return; // already populated
  }
  await db.execAsync(seedSql); // the .sql wraps its own DROP/CREATE/INSERT in a txn
}

export async function insertItems(items: InventoryItem[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO inventory_items
           (id, normalized_name, quantity, unit, storage_zone,
            estimated_shelf_life_days, barcode_gtin, added_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        it.id,
        it.normalized_name,
        it.quantity,
        it.unit,
        it.storage_zone,
        it.estimated_shelf_life_days,
        it.barcode_gtin,
        it.added_at,
        it.expires_at
      );
    }
  });
}

/** Items expiring within `hours` from now — used for the recipe nudge. */
export async function getExpiringItems(hours = 48): Promise<InventoryItem[]> {
  const db = await getDb();
  const cutoff = Date.now() + hours * 3_600_000;
  return db.getAllAsync<InventoryItem>(
    "SELECT * FROM inventory_items WHERE expires_at <= ? ORDER BY expires_at ASC",
    cutoff
  );
}

/** All pantry items, soonest-to-expire first. */
export async function getAllItems(): Promise<InventoryItem[]> {
  const db = await getDb();
  return db.getAllAsync<InventoryItem>(
    "SELECT * FROM inventory_items ORDER BY expires_at ASC"
  );
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM inventory_items WHERE id = ?", id);
}

/** Seed the bundled curated shelf-life data on first launch. */
export async function initDatabase(seedSql: string): Promise<void> {
  await getDb();
  await ensureShelfLifeSeeded(seedSql);
}
