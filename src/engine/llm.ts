// Thin client for the AI proxy (proxy/worker.js). The Gemini key lives in the
// proxy, never in the app — this module only talks to that proxy.

const ENDPOINT = process.env.EXPO_PUBLIC_FRIDGEFORAGE_API ?? "https://api.fridgeforage.app";
const TIMEOUT_MS = 20_000;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI endpoint ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Defensive parse: the proxy SHOULD return the tool_use input directly, but if
 * anything upstream hands back a text blob with the JSON embedded, recover it.
 * This is the belt to the tool-schema's suspenders — "the parser crashed"
 * must never be reachable.
 */
export function extractJson(payload: unknown): any {
  if (payload && typeof payload === "object") return payload;
  if (typeof payload === "string") {
    const cleaned = payload.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          /* fall through */
        }
      }
    }
  }
  return null;
}

export interface IntakeResult {
  processing_status: "SUCCESS" | "PARTIAL" | "EMPTY";
  items: unknown[];
}

/**
 * @param input  either OCR'd receipt text or a base64 JPEG (resized client-side
 *               to <=1200px / 75% quality before calling — see README).
 */
export async function aiInventoryIntake(input: { text?: string; imageBase64?: string }): Promise<IntakeResult> {
  try {
    const raw = await postJson<unknown>("/v1/intake", input);
    const parsed = extractJson(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { processing_status: "EMPTY", items: [] };
    return parsed as IntakeResult;
  } catch {
    return { processing_status: "EMPTY", items: [] }; // offline / failure -> empty, UI handles it
  }
}

export interface RecipeResult {
  title: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  difficulty_rating: "Easy" | "Medium" | "Hard";
  expiring_items_utilized: string[];
  common_pantry_staples_required: string[];
  mobile_ui_steps: string[];
}

export async function aiGenerateRecipe(expiringItemNames: string[], staples: string[] = []): Promise<RecipeResult | null> {
  try {
    const raw = await postJson<unknown>("/v1/recipe", { expiring_items: expiringItemNames, staples });
    return extractJson(raw) as RecipeResult | null;
  } catch {
    return null;
  }
}
