import { getAllItems, type InventoryItem, type StorageZone } from '@/engine/db';
import { daysLeft } from './expiry';

export interface DashboardStats {
  total: number;
  fresh: number;
  soon: number; // 0–2 days, not yet expired
  expired: number;
  freshnessScore: number; // 0–100
  byZone: Record<StorageZone, number>;
  expiringSoon: InventoryItem[];
  items: InventoryItem[];
}

export async function loadDashboard(): Promise<DashboardStats> {
  const items = await getAllItems();
  let fresh = 0;
  let soon = 0;
  let expired = 0;
  const byZone: Record<StorageZone, number> = { fridge: 0, pantry: 0, freezer: 0 };

  for (const it of items) {
    const d = daysLeft(it.expires_at);
    if (d < 0) expired++;
    else if (d <= 2) soon++;
    else fresh++;
    byZone[it.storage_zone] = (byZone[it.storage_zone] ?? 0) + 1;
  }

  const total = items.length;
  const freshnessScore = total ? Math.round((fresh / total) * 100) : 100;
  const expiringSoon = items
    .filter((i) => {
      const d = daysLeft(i.expires_at);
      return d >= 0 && d <= 3;
    })
    .slice(0, 8);

  return { total, fresh, soon, expired, freshnessScore, byZone, expiringSoon, items };
}
