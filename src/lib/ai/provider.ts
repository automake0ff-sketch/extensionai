// Provider-agnostic interface for the AI layer (see spec section 3/33).
// The rest of the app (lib/ai/extension.ts and API routes) only depends on
// this interface, never on a specific vendor SDK. Swapping models/providers
// means adding a new file here and pointing AI_PROVIDER at it.

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
}

export interface AiCompletionResult {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
