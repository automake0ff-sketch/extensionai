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
// qwen/qwen3-coder:free requires "Enable training and logging" turned on
// in the OpenRouter account's privacy settings (openrouter.ai/settings/privacy)
// -- without it every request 404s with "No endpoints found matching your
// data policy". This applies to OpenRouter's free models in general, not
// anything specific to this one. Also note free-tier request caps: 20/min,
// and 50/day total across all free models unless the account has ever
// purchased credits (then 1000/day) -- watch for 429s under real load.
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-coder:free";
export { DEFAULT_OPENROUTER_MODEL };

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = DEFAULT_OPENROUTER_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model: this.model,
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
        throw new Error(`OpenRouter request timed out after ${elapsed}s (model ${this.model}).`);
      }
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter API request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    console.log(`[openrouter] ${this.model} responded in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    const text = data.choices?.[0]?.message?.content ?? "";
    const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return { text, tokensUsed, model: data.model ?? this.model };
  }
}
