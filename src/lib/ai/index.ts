import type { AiProvider } from "./provider";
import { DEFAULT_AI_MODEL } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenRouterProvider, DEFAULT_OPENROUTER_MODEL } from "./providers/openrouter";

let cachedProvider: AiProvider | null = null;

/**
 * Returns the configured AI provider. Selection is driven entirely by
 * environment variables (AI_PROVIDER, AI_API_KEY, AI_MODEL) so switching
 * vendors never requires touching application code — see ENVIRONMENT.md.
 */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER ?? "anthropic";
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "AI_API_KEY is not set. Configure it in your environment (see .env.example)."
    );
  }

  switch (providerName) {
    case "anthropic":
      cachedProvider = new AnthropicProvider(apiKey, process.env.AI_MODEL);
      break;
    case "openrouter":
      cachedProvider = new OpenRouterProvider(apiKey, process.env.AI_MODEL);
      break;
    default:
      throw new Error(`Unknown AI_PROVIDER "${providerName}".`);
  }

  return cachedProvider;
}

/**
 * The model string to *record* (e.g. on a `generations` doc) when AI_MODEL
 * isn't explicitly set — kept separate from each provider's own internal
 * default so the two can never drift apart or report the wrong vendor's
 * model name for whichever AI_PROVIDER is actually configured.
 */
export function getDefaultModelForRecording(): string {
  const providerName = process.env.AI_PROVIDER ?? "anthropic";
  switch (providerName) {
    case "openrouter":
      return DEFAULT_OPENROUTER_MODEL;
    case "anthropic":
    default:
      return DEFAULT_AI_MODEL;
  }
}

export type { AiProvider, AiCompletionRequest, AiCompletionResult, AiMessage } from "./provider";
export { DEFAULT_AI_MODEL } from "./provider";
