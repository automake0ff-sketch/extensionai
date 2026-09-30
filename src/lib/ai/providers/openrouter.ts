import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../provider";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter's free tier is the reason this provider exists — it lets
 * ExtenAI run without paying for AI credits, at the cost of generally
 * less reliable instruction-following than a paid frontier model (matters
 * here because every prompt in lib/ai/prompts.ts demands raw JSON with a
 * specific shape; a free/smaller model is more likely to wrap it in prose
 * or markdown fences, which extractJson() in lib/ai/schemas.ts defends
 * against, or to violate the schema outright, which surfaces as an
 * AiResponseValidationError instead of silently storing garbage).
 *
 * OpenRouter's catalog of free (":free" suffix) models rotates over time —
 * some get removed or rate-limited more aggressively than others. Check
 * https://openrouter.ai/models?max_price=0 for what's currently available
 * and set AI_MODEL to match if the default here stops working.
 */
const REQUEST_TIMEOUT_MS = 140_000;

// OpenRouter's free-tier catalog is unstable: a ":free" model can be pulled
// from the free tier with no warning, at which point it 404s with a message
// like "This model is unavailable for free. The paid version is available
// now - use this slug instead: ...". This has already happened twice in
// this project's history (meta-llama/llama-3.3-70b-instruct:free, then
// qwen/qwen3-coder:free), so rather than hand-updating AI_MODEL every time
// OpenRouter retires the current pick, complete() below falls back through
// this list automatically when it hits that specific error. AI_MODEL (env)
// is always tried first; this list is what it falls back to.
//
// Also note two things that are NOT model-specific and apply to every free
// model here: (1) the OpenRouter account needs "Enable training and
// logging" on in Privacy Settings (openrouter.ai/settings/privacy), or
// every free-model request 404s with "No endpoints found matching your
// data policy"; (2) free-tier request caps are 20/min and 50/day total
// across ALL free models unless the account has ever purchased credits
// (then 1000/day) -- watch for 429s under real load.
//
// Re-check what's actually free (this list goes stale too) via:
//   curl https://openrouter.ai/api/v1/models | jq '.data[] | select(.pricing.prompt=="0") | .id'
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3.8-27b:free";
const FALLBACK_FREE_MODELS = [
  "qwen/qwen3.8-27b:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "dots-studio/dots-3-note-preview:free",
];
export { DEFAULT_OPENROUTER_MODEL, FALLBACK_FREE_MODELS };

/** True for the specific 404 OpenRouter returns when a :free slug has been retired. */
function isModelRetiredError(status: number, body: string): boolean {
  return status === 404 && /unavailable for free|no endpoints found/i.test(body);
}

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = DEFAULT_OPENROUTER_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // Try the configured model first, then fall back through the known-free
    // list (skipping the configured model if it's already in there) when a
    // model has been retired from the free tier -- see isModelRetiredError.
    const candidates = [this.model, ...FALLBACK_FREE_MODELS.filter((m) => m !== this.model)];
    let lastError: Error | undefined;

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const startedAt = Date.now();
      let res: Response;
      try {
        res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            // Optional, but OpenRouter's docs ask for this to attribute usage —
            // doesn't affect functionality if left generic.
            "X-Title": "ExtenAI",
          },
          // Two of these calls run back to back per generation (Architect,
          // then Coder) inside a 300s serverless limit. Cap each one so a
          // stalled provider produces a clean, catchable error instead of the
          // platform killing the whole request with a plain-text 504.
          signal: AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            model,
            max_tokens: request.maxTokens ?? 8000,
            // Prefer the fastest available provider for this model rather than
            // the cheapest, which is often the most congested.
            provider: { sort: "throughput" },
            messages: [
              { role: "system", content: request.system },
              ...request.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
      } catch (err) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
          throw new Error(
            `OpenRouter request timed out after ${elapsed}s (model ${model}, budget ${Math.round((request.timeoutMs ?? REQUEST_TIMEOUT_MS) / 1000)}s).`
          );
        }
        throw err;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (isModelRetiredError(res.status, body) && i < candidates.length - 1) {
          console.warn(`[openrouter] ${model} no longer free, falling back to ${candidates[i + 1]}`);
          lastError = new Error(`OpenRouter API request failed (${res.status}): ${body.slice(0, 300)}`);
          continue;
        }
        throw new Error(`OpenRouter API request failed (${res.status}): ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      console.log(`[openrouter] ${model} responded in ${Math.round((Date.now() - startedAt) / 1000)}s`);
      const text = data.choices?.[0]?.message?.content ?? "";
      const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

      return { text, tokensUsed, model: data.model ?? model };
    }

    // Unreachable in practice (the loop always returns or throws), but keeps
    // TypeScript happy and gives a sane error if it ever is reached.
    throw lastError ?? new Error("OpenRouter API request failed: no model candidates available.");
  }
}
