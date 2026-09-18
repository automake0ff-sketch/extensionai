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
const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
export { DEFAULT_OPENROUTER_MODEL };

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = DEFAULT_OPENROUTER_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        // Optional, but OpenRouter's docs ask for this to attribute usage —
        // doesn't affect functionality if left generic.
        "X-Title": "ExtenAI",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 8000,
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter API request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return { text, tokensUsed, model: data.model ?? this.model };
  }
}
