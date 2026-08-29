import Anthropic from "@anthropic-ai/sdk";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../provider";

/**
 * Anthropic implementation of AiProvider. Reads its API key from AI_API_KEY
 * (see .env.example / ENVIRONMENT.md) so the rest of the codebase never
 * touches vendor SDKs directly.
 */
export class AnthropicProvider implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 8000,
      system: request.system,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      model: this.model,
    };
  }
}
