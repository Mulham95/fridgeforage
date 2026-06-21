// Web data layer (Metro picks .web.ts over .ts on web). localStorage-backed
// so the browser build never imports expo-sqlite.

export type StorageZone = 'fridge' | 'pantry' | 'freezer';

export interface InventoryItem {
  id: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  storage_zone: StorageZone;
  estimated_shelf_life_days: number;
  barcode_gtin: string | null;
  added_at: number;
  expires_at: number;
}

const KEY = 'fridgeforage_items';
const ls: any = (globalThis as any).localStorage;

function loadItems(): InventoryItem[] {
  try {
    const raw = ls?.getItem(KEY);
    return raw ? (JSON.parse(raw) as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

let items: InventoryItem[] = loadItems();

function persist() {
  try {
    ls?.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / unavailable */
  }
}

export async function getDb(): Promise<never> {
  throw new Error('SQLite is not available on web');
}

// On web the shelf-life data lives in shelfLife.web.ts (parsed JS), not SQLite.
export async function initDatabase(_seedSql: string): Promise<void> {}

export async function insertItems(newItems: InventoryItem[]): Promise<void> {
  for (const it of newItems) {
    const i = items.findIndex((x) => x.id === it.id);
    if (i >= 0) items[i] = it;
    else items.push(it);
  }
  persist();
}

export async function getAllItems(): Promise<InventoryItem[]> {
  return [...items].sort((a, b) => a.expires_at - b.expires_at);
}

export async function getExpiringItems(hours = 48): Promise<InventoryItem[]> {
  const cutoff = Date.now() + hours * 3_600_000;
  return items.filter((i) => i.expires_at <= cutoff).sort((a, b) => a.expires_at - b.expires_at);
}

export async function deleteItem(id: string): Promise<void> {
  items = items.filter((i) => i.id !== id);
  persist();
}

export async function getItem(id: string): Promise<InventoryItem | null> {
  return items.find((i) => i.id === id) ?? null;
}

export async function updateItem(
  id: string,
  fields: Partial<Pick<InventoryItem, 'normalized_name' | 'quantity' | 'unit' | 'storage_zone' | 'estimated_shelf_life_days'>>
): Promise<void> {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  const merged = { ...items[i], ...fields };
  merged.expires_at = merged.added_at + merged.estimated_shelf_life_days * 86_400_000;
  items[i] = merged;
  persist();
}
