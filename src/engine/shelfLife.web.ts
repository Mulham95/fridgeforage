/**
 * Web shelf-life lookup. Metro picks this over shelfLife.ts on web. It parses
 * the same curated seed SQL into a JS array and runs the identical 3-step match
 * (exact → rule-in-query → query-in-rule) without SQLite.
 */
import { SHELF_LIFE_SEED_SQL } from './seedData';
import type { StorageZone } from './db';

export interface ShelfLifeRule {
  id: number;
  category: string;
  name: string;
  refrigerate_days: number | null;
  pantry_days: number | null;
  freeze_days: number | null;
  default_zone: StorageZone;
}

interface Row extends ShelfLifeRule {
  name_lc: string;
}

function parseFields(inner: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (ch === "'") {
        if (inner[i + 1] === "'") { cur += "'"; i++; }
        else inStr = false;
      } else cur += ch;
    } else if (ch === "'") inStr = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const num = (s: string): number | null => (s === 'NULL' ? null : Number(s));

const ROWS: Row[] = (() => {
  const rows: Row[] = [];
  for (const m of SHELF_LIFE_SEED_SQL.matchAll(/VALUES\s*\((.*?)\);/g)) {
    const f = parseFields(m[1]);
    if (f.length < 8) continue;
    rows.push({
      id: Number(f[0]),
      category: f[1],
      name: f[2],
      name_lc: f[3],
      refrigerate_days: num(f[4]),
      pantry_days: num(f[5]),
      freeze_days: num(f[6]),
      default_zone: f[7] as StorageZone,
    });
  }
  return rows;
})();

export interface ShelfLifeMatch {
  days: number;
  zone: StorageZone;
  source: 'foodkeeper';
  matchedName: string;
}

export async function lookupShelfLife(normalizedName: string): Promise<ShelfLifeMatch | null> {
  const q = normalizedName.trim().toLowerCase();
  if (!q) return null;

  let rule: Row | undefined = ROWS.find((r) => r.name_lc === q);
  if (!rule) {
    rule = ROWS.filter((r) => q.includes(r.name_lc)).sort((a, b) => b.name_lc.length - a.name_lc.length)[0];
  }
  if (!rule) {
    rule = ROWS.filter((r) => r.name_lc.includes(q)).sort((a, b) => a.name_lc.length - b.name_lc.length)[0];
  }
  if (!rule) return null;

  const zone = rule.default_zone;
  const days =
    zone === 'fridge' ? rule.refrigerate_days : zone === 'pantry' ? rule.pantry_days : rule.freeze_days;
  if (days == null) return null;
  return { days, zone, source: 'foodkeeper', matchedName: rule.name };
}
