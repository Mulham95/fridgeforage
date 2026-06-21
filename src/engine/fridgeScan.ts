/**
 * "Scan your fridge → get a dish" flow.
 *
 * Takes a photo of the fridge interior, asks the AI vision model to identify the
 * food items in it (reusing INVENTORY_INTAKE), then generates a recipe from the
 * detected ingredients. Detection does NOT auto-save — the user decides whether
 * to add the items to their pantry afterwards.
 */
import { insertItems, type InventoryItem } from './db';
import { aiGenerateRecipe, aiInventoryIntake, AiClientError, type RecipeResult } from './llm';
import { scheduleExpiryNotifications } from './notifications';
import { toInventoryItems } from './validation';

export type FridgeScanStatus = 'ok' | 'no_items' | 'rate_limit' | 'error';

export interface FridgeScanResult {
  items: InventoryItem[]; // detected ingredients (validated, not yet saved)
  recipe: RecipeResult | null;
  status: FridgeScanStatus;
  errorMessage?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function scanFridge(imageBase64: string): Promise<FridgeScanResult> {
  // Step 1: identify the ingredients in the photo.
  let items: InventoryItem[];
  try {
    const ai = await aiInventoryIntake({ imageBase64 });
    items = toInventoryItems(ai.items);
  } catch (error: any) {
    console.error('Fridge intake failed', error);
    if (error instanceof AiClientError && error.kind === 'rate_limit') {
      return { items: [], recipe: null, status: 'rate_limit', errorMessage: error.message };
    }
    return { items: [], recipe: null, status: 'error', errorMessage: String(error?.message || error) };
  }
  if (items.length === 0) return { items: [], recipe: null, status: 'no_items' };

  // Step 2: small gap before the recipe call so we don't burn 2 calls in the
  // same second of the free-tier RPM budget (10/min on gemini-2.5-flash).
  await sleep(1500);

  try {
    const names = items.map((i) => i.normalized_name);
    const recipe = await aiGenerateRecipe(names);
    return { items, recipe, status: 'ok' };
  } catch (error: any) {
    console.error('Recipe generation after fridge scan failed', error);
    // We still got the ingredients — return them with a null recipe and let the
    // UI offer a manual "Generate recipe" retry. Don't lose the work.
    return { items, recipe: null, status: 'ok', errorMessage: String(error?.message || error) };
  }
}

/** Persist the detected ingredients to the pantry on demand. */
export async function saveDetected(items: InventoryItem[]): Promise<void> {
  if (!items.length) return;
  await insertItems(items);
  await scheduleExpiryNotifications();
}
