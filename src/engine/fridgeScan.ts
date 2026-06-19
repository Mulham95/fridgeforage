/**
 * "Scan your fridge → get a dish" flow.
 *
 * Takes a photo of the fridge interior, asks the AI vision model to identify the
 * food items in it (reusing INVENTORY_INTAKE), then generates a recipe from the
 * detected ingredients. Detection does NOT auto-save — the user decides whether
 * to add the items to their pantry afterwards.
 */
import { aiInventoryIntake, aiGenerateRecipe, type RecipeResult } from './llm';
import { toInventoryItems } from './validation';
import { insertItems, type InventoryItem } from './db';
import { scheduleExpiryNotifications } from './notifications';

export type FridgeScanStatus = 'ok' | 'no_items' | 'error';

export interface FridgeScanResult {
  items: InventoryItem[]; // detected ingredients (validated, not yet saved)
  recipe: RecipeResult | null;
  status: FridgeScanStatus;
}

export async function scanFridge(imageBase64: string): Promise<FridgeScanResult> {
  try {
    const ai = await aiInventoryIntake({ imageBase64 });
    const items = toInventoryItems(ai.items);
    if (items.length === 0) return { items: [], recipe: null, status: 'no_items' };

    const names = items.map((i) => i.normalized_name);
    const recipe = await aiGenerateRecipe(names);
    return { items, recipe, status: 'ok' };
  } catch {
    return { items: [], recipe: null, status: 'error' };
  }
}

/** Persist the detected ingredients to the pantry on demand. */
export async function saveDetected(items: InventoryItem[]): Promise<void> {
  if (!items.length) return;
  await insertItems(items);
  await scheduleExpiryNotifications();
}
