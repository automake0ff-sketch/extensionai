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
// data policy"; (2) free-tier request caps are 20/min and 50/day total per
// API KEY across ALL free models unless that key's account has ever
// purchased credits (then 1000/day) -- this is exactly what AI_API_KEY's
// multi-key support right below is for.
//
// Re-check what's actually free (this list goes stale too) via:
//   curl https://openrouter.ai/api/v1/models | jq '.data[] | select(.pricing.prompt=="0") | .id'
// qwen/qwen3.8-27b:free was the default until it was fully retired (confirmed
// 404 "unavailable for free" on every call in production, and absent entirely
// from a live query to https://openrouter.ai/api/v1/models) -- promoted
// inclusionai/ling-3.0-flash-sante:free since it's the one actually
// responding reliably (1-7s) in production logs.
const DEFAULT_OPENROUTER_MODEL = "inclusionai/ling-3.0-flash-sante:free";
// Deliberately spread across different providers/families (InclusionAI,
// Apodex), not just one vendor's variants -- confirmed in production that
// when one model gets congested upstream, it's plausible for the whole
// family/provider to be congested together, and a different provider is more
// likely to be unaffected. All confirmed free (pricing.prompt == "0") via a
// live query to https://openrouter.ai/api/v1/models at the time this list
// was last updated.
const FALLBACK_FREE_MODELS = [
  "inclusionai/ling-3.0-flash-sante:free",
  "apodex/apodex-1.1-mini:free",
  "inclusionai/ling-3.1-flash",
  "dots-studio/dots-3-note-preview:free",
];
export { DEFAULT_OPENROUTER_MODEL, FALLBACK_FREE_MODELS };

/** True for the specific 404 OpenRouter returns when a :free slug has been retired. */
function isModelRetiredError(status: number, body: string): boolean {
  return status === 404 && /unavailable for free|no endpoints found/i.test(body);
}

/**
 * True when the failure is about the *key/account*, not the model: the
 * free-tier daily/minute cap was hit (429), the account has no credits for
 * a call that needs them (402), or the key itself is invalid/revoked (401).
 * In every one of these, retrying the same key with a different model won't
 * help -- only a different key can.
 */
function isKeyExhaustedError(status: number): boolean {
  return status === 401 || status === 402 || status === 429;
}

export class OpenRouterProvider implements AiProvider {
  private apiKeys: string[];
  private model: string;

  /**
   * apiKey can be a single key or an array of keys. Multiple keys are tried
   * in order: when one is rate-limited, out of credits, or invalid, the
   * next one is used automatically -- this is what lets a stack of several
   * free OpenRouter accounts' keys behave like one pool with a much higher
   * combined daily cap, instead of the whole generation failing the moment
   * the first key's free-tier allowance (50 or 1000 requests/day) runs out.
   */
  constructor(apiKey: string | string[], model = DEFAULT_OPENROUTER_MODEL) {
    this.apiKeys = (Array.isArray(apiKey) ? apiKey : [apiKey]).map((k) => k.trim()).filter(Boolean);
    if (this.apiKeys.length === 0) {
      throw new Error("OpenRouterProvider requires at least one API key.");
    }
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // Try the configured model first, then fall back through the known-free
    // list (skipping the configured model if it's already in there) when a
    // model has been retired from the free tier -- see isModelRetiredError.
    const candidates = [this.model, ...FALLBACK_FREE_MODELS.filter((m) => m !== this.model)];
    let lastError: Error | undefined;

    for (let k = 0; k < this.apiKeys.length; k++) {
      const apiKey = this.apiKeys[k];
      const keyLabel = this.apiKeys.length > 1 ? `key #${k + 1}/${this.apiKeys.length}` : "key";

      for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const startedAt = Date.now();
        let res: Response;
        try {
          res = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
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
              // Several of the free fallback models (the InclusionAI Ling
              // family, Apodex) have reasoning ON by default. Those reasoning
              // tokens count against max_tokens same as the real answer, and
              // were confirmed in production to eat enough of the 8000-token
              // Coder budget to truncate its JSON before it closed ("Unexpected
              // end of JSON input") -- two retries in a row, same model. We
              // want raw JSON, not chain-of-thought, so turn it off everywhere;
              // OpenRouter honors this uniformly across reasoning-capable
              // models and ignores it harmlessly on ones without reasoning.
              reasoning: { enabled: false },
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
          lastError = new Error(`OpenRouter API request failed (${res.status}): ${body.slice(0, 300)}`);
          const retryable = isKeyExhaustedError(res.status) || isModelRetiredError(res.status, body);

          if (retryable && i < candidates.length - 1) {
            // A 429 here is often the MODEL being congested upstream (shared
            // across everyone on OpenRouter's free tier), not this key's own
            // quota -- a different model is more likely to actually fix that
            // than a different key would, so exhaust the model list for the
            // current key before burning through other keys. Confirmed in
            // production: all 3 configured keys got the same
            // "temporarily rate-limited upstream" 429 for the same model.
            console.warn(`[openrouter] ${model} failed (${res.status}) on ${keyLabel}, trying ${candidates[i + 1]}`);
            continue; // same key, next model
          }
          if (retryable && k < this.apiKeys.length - 1) {
            console.warn(`[openrouter] ${keyLabel} exhausted every model, rotating to next key`);
            break; // every model failed on this key -- try the next key, from its first model
          }
          // Not something rotating a key or model can fix (or we're out of
          // both) -- surface the real error instead of masking it.
          throw lastError;
        }

        const data = await res.json();
        console.log(
          `[openrouter] ${model} (${keyLabel}) responded in ${Math.round((Date.now() - startedAt) / 1000)}s`
        );
        const text = data.choices?.[0]?.message?.content ?? "";
        const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

        return { text, tokensUsed, model: data.model ?? model };
      }
    }

    // Unreachable in practice (the loop always returns or throws), but keeps
    // TypeScript happy and gives a sane error if every key and model failed.
    throw lastError ?? new Error("OpenRouter API request failed: no key/model candidates available.");
  }
}
