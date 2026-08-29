import type { AiProvider } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";

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
    default:
      throw new Error(`Unknown AI_PROVIDER "${providerName}".`);
  }

  return cachedProvider;
}

export type { AiProvider, AiCompletionRequest, AiCompletionResult, AiMessage } from "./provider";
