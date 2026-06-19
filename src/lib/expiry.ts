/** Presentation helpers for expiry state — pure, no RN imports. */

export function daysLeft(expiresAt: number, now = Date.now()): number {
  return Math.ceil((expiresAt - now) / 86_400_000);
}

/** Traffic-light color for how close an item is to expiring. */
export function expiryColor(days: number): string {
  if (days <= 0) return "#E5484D"; // expired — red
  if (days <= 2) return "#F76808"; // urgent — orange
  if (days <= 5) return "#FFB224"; // soon — amber
  return "#30A46C"; // fresh — green
}

export function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export const ZONE_META: Record<string, { emoji: string; label: string }> = {
  fridge: { emoji: "🧊", label: "Fridge" },
  pantry: { emoji: "🥫", label: "Pantry" },
  freezer: { emoji: "❄️", label: "Freezer" },
};
