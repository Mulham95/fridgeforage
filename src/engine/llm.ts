// Thin client for the AI proxy (proxy/worker.js). The Gemini key lives in the
// proxy, never in the app — this module only talks to that proxy.

const ENDPOINT = process.env.EXPO_PUBLIC_FRIDGEFORAGE_API ?? "https://api.fridgeforage.app";
// Only set in mobile/EAS builds — never in the public web build. The Worker
// accepts EITHER a matching secret OR an allow-listed Origin, so the web bundle
// passes via Origin/CORS without needing (or leaking) this value.
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "";
const TIMEOUT_MS = 25_000;

/**
 * Typed error so callers can show the right message. `kind` is the dimension
 * the UI cares about; `status` is the raw HTTP status if available.
 */
export class AiClientError extends Error {
  kind: "rate_limit" | "auth" | "network" | "upstream";
  status?: number;
  retryAfterSec?: number;
  constructor(kind: AiClientError["kind"], message: string, status?: number, retryAfterSec?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

async function rawFetch(path: string, body: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (APP_SECRET) headers["x-app-secret"] = APP_SECRET;
    return await fetch(`${ENDPOINT}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * POST with one auto-retry on 429 (using the Retry-After header from the proxy,
 * capped at 8s so a fridge-scan flow doesn't hang on the user). Throws an
 * AiClientError tagged with the failure kind so the UI can render a clear
 * message instead of "Couldn't reach the AI".
 */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await rawFetch(path, body);
    } catch (e: any) {
      // fetch threw — network/timeout/DNS. No retry, surface as 'network'.
      throw new AiClientError("network", e?.message || "no connection");
    }

    if (res.ok) return (await res.json()) as T;

    if (res.status === 429 && attempt === 0) {
      const ra = parseInt(res.headers.get("Retry-After") || "5", 10);
      await sleep(Math.min(Math.max(ra, 2), 8) * 1000);
      continue; // retry once
    }

    if (res.status === 429) {
      throw new AiClientError("rate_limit", "too many requests", 429,
        parseInt(res.headers.get("Retry-After") || "60", 10));
    }
    if (res.status === 401 || res.status === 403) {
      throw new AiClientError("auth", `auth failed (${res.status})`, res.status);
    }
    throw new AiClientError("upstream", `upstream ${res.status}`, res.status);
  }
  throw new AiClientError("upstream", "unreachable");
}

// Defensive parse: proxy returns parsed JSON, but recover gracefully if anything
// upstream hands back a text blob with JSON embedded (e.g. wrapped in ``` fences).
function extractJson(payload: unknown): any {
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
 * @param input  either OCR'd receipt text or a base64 JPEG.
 * @throws AiClientError on failure (caller decides what to show).
 */
export async function aiInventoryIntake(
  input: { text?: string; imageBase64?: string },
  allowFallback = false
): Promise<IntakeResult> {
  try {
    const raw = await postJson<unknown>("/v1/intake", input);
    const parsed = extractJson(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      if (allowFallback) return { processing_status: "EMPTY", items: [] };
      throw new AiClientError("upstream", "invalid intake response");
    }
    return parsed as IntakeResult;
  } catch (error) {
    if (allowFallback && !(error instanceof AiClientError && error.kind === "rate_limit")) {
      return { processing_status: "EMPTY", items: [] };
    }
    throw error;
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

/**
 * @throws AiClientError on failure. (Used to swallow errors and return null,
 *         which is why the UI could only say "couldn't reach".)
 */
export async function aiGenerateRecipe(
  expiringItemNames: string[],
  staples: string[] = []
): Promise<RecipeResult> {
  const raw = await postJson<unknown>("/v1/recipe", { expiring_items: expiringItemNames, staples });
  const r = extractJson(raw) as RecipeResult | null;
  if (!r) throw new AiClientError("upstream", "invalid recipe response");
  return r;
}

/** Map any error from this module into a short user-facing string. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiClientError) {
    switch (err.kind) {
      case "rate_limit":
        return "Too many AI requests right now — please wait about a minute and try again.";
      case "auth":
        return "The app couldn't authenticate with the AI service.";
      case "network":
        return "No connection — check your internet and try again.";
      default:
        return "The AI service had a problem. Please try again in a moment.";
    }
  }
  return "Something went wrong. Please try again.";
}
