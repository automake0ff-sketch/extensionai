// Provider-agnostic interface for the AI layer (see spec section 3/33).
// The rest of the app (lib/ai/extension.ts and API routes) only depends on
// this interface, never on a specific vendor SDK. Swapping models/providers
// means adding a new file here and pointing AI_PROVIDER at it.

/**
 * Single source of truth for the default model string, used when AI_MODEL
 * isn't set. Confirm this matches a model your Anthropic account actually
 * has access to before launch — see LAUNCH_CHECKLIST.md.
 */
export const DEFAULT_AI_MODEL = "claude-sonnet-4-6";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  /** Hint that the caller expects raw JSON back (no prose, no code fences). */
  jsonMode?: boolean;
  /**
   * Caller-supplied budget for this specific call, in ms. Lets a caller that
   * knows how much of a larger time limit (e.g. a 300s serverless function)
   * is left give a slow call every remaining second instead of an arbitrary
   * fixed per-call timeout. Providers should fall back to their own default
   * when this is omitted.
   */
  timeoutMs?: number;
}

export interface AiCompletionResult {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
