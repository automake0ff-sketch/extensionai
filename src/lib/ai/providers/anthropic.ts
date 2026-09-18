import Anthropic from "@anthropic-ai/sdk";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../provider";
import { DEFAULT_AI_MODEL } from "../provider";

/**
 * Anthropic implementation of AiProvider. Reads its API key from AI_API_KEY
 * (see .env.example / ENVIRONMENT.md) so the rest of the codebase never
 * touches vendor SDKs directly.
 *
 * Some Anthropic API keys are issued at the organization level rather than
 * scoped to a single workspace — those require an `anthropic-workspace-id`
 * header on every request, or the API rejects calls with a 400
 * "not scoped to a workspace" error. Set ANTHROPIC_WORKSPACE_ID if you're
 * using that kind of key; workspace-scoped keys (the default when you
 * create one from inside a specific workspace in the console) don't need it.
 */
export class AnthropicProvider implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = DEFAULT_AI_MODEL) {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    this.client = new Anthropic({
      apiKey,
      defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
    });
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
