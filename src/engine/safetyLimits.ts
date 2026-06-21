// Food-safety clamps. The LLM is untrusted — a hallucinated shelf-life for raw
// chicken is a food-poisoning vector. Every model-supplied shelf-life value
// passes through clampShelfLife before it can reach the DB or a notification.
import type { StorageZone } from "./db";

interface Ceiling {
  test: RegExp;
  maxDays: number;
}

// Order matters: first match wins, so most dangerous categories go first.
const CEILINGS: Ceiling[] = [
  { test: /\b(chicken|turkey|poultry|salmon|tuna|fish|seafood|shrimp|shellfish|oyster|mussel|clam)\b/i, maxDays: 2 },
  { test: /\bground\s+(beef|pork|turkey|chicken|meat)\b/i, maxDays: 2 },
  { test: /\b(beef|pork|lamb|veal|steak|chop|roast|sausage|bacon|deli|ham)\b/i, maxDays: 5 },
  // No trailing \b: stems like "strawberr" must match "Strawberries"/"strawberry".
  { test: /\b(berr|raspberr|strawberr|blueberr|blackberr|melon|cut\s+fruit)/i, maxDays: 5 },
  { test: /\b(leftover|cooked|prepared)\b/i, maxDays: 4 },
  { test: /\b(milk|cream|yogurt|soft\s+cheese|cottage|ricotta)\b/i, maxDays: 7 },
  { test: /\b(egg|eggs)\b/i, maxDays: 35 },
];

// Absolute ceilings by zone, applied after the name-based ceiling.
const ZONE_MAX: Record<StorageZone, number> = {
  fridge: 60, // nothing perishable should claim > 2 months in a fridge
  pantry: 365,
  freezer: 365,
};

/**
 * Clamp a model- or user-supplied shelf life for a given item.
 * Returns an integer >= 1.
 */
export function clampShelfLife(
  name: string,
  zone: StorageZone,
  days: number
): number {
  let d = Math.floor(Number.isFinite(days) ? days : 1);
  if (d < 1) d = 1;

  for (const c of CEILINGS) {
    if (c.test.test(name)) {
      d = Math.min(d, c.maxDays);
      break;
    }
  }
  d = Math.min(d, ZONE_MAX[zone]);
  return d;
}

/** True if this item is high-risk and the UI should show a "use by" warning. */
export function isHighRisk(name: string): boolean {
  return CEILINGS.slice(0, 2).some((c) => c.test.test(name));
}
