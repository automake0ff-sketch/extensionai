import { getAiProvider } from "./index";
import {
  ARCHITECT_PROMPT,
  CODER_PROMPT,
  MODIFIER_PROMPT,
  REVIEWER_PROMPT,
  TESTER_PROMPT,
} from "./prompts";
import {
  architectPlanSchema,
  extensionAnalysisSchema,
  extensionGenerationSchema,
  extensionModificationSchema,
  extractJson,
  testPlanSchema,
} from "./schemas";
import type {
  ExtensionAnalysisResult,
  ExtensionGenerationResult,
  ExtensionModificationResult,
  ProjectFile,
  TestPlanResult,
} from "@/lib/types";

export class AiResponseValidationError extends Error {
  constructor(message: string, public raw: string) {
    super(message);
    this.name = "AiResponseValidationError";
  }
}

// Only retry the Coder if less than this much of the request has elapsed,
// so a retry can't push the whole request past the 300s platform limit.
const RETRY_BUDGET_MS = 110_000;

interface GenerateExtensionResult {
  result: ExtensionGenerationResult;
  tokensUsed: number;
  model: string;
}

/**
 * Full pipeline for spec section 7/33: Architect plans the extension, then
 * Coder writes the files based on that plan. Returns a validated, structured
 * result — never raw/arbitrary text.
 */
export async function generateExtension(prompt: string): Promise<GenerateExtensionResult> {
  const provider = getAiProvider();
  const startedAt = Date.now();

  const architectResponse = await provider.complete({
    system: ARCHITECT_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2000,
  });

  let plan;
  try {
    plan = architectPlanSchema.parse(extractJson(architectResponse.text));
  } catch (err) {
    throw new AiResponseValidationError(
      `Architect response failed validation: ${(err as Error).message}`,
      architectResponse.text
    );
  }

  const coderUserContent = `User request: ${prompt}\n\nArchitect plan:\n${JSON.stringify(plan, null, 2)}`;

  let coderResponse = await provider.complete({
    system: CODER_PROMPT,
    messages: [{ role: "user", content: coderUserContent }],
    maxTokens: 8000,
  });
  let coderTokens = coderResponse.tokensUsed;

  let generated;
  try {
    generated = extensionGenerationSchema.parse(extractJson(coderResponse.text));
  } catch (firstErr) {
    // One retry, only if there's time left inside the serverless limit
    // (each provider call can take up to ~140s). The model usually fixes
    // its own malformed JSON when told exactly what was wrong.
    if (Date.now() - startedAt > RETRY_BUDGET_MS) {
      throw new AiResponseValidationError(
        `Coder response failed validation: ${(firstErr as Error).message}`,
        coderResponse.text
      );
    }
    console.warn("[generate] coder output invalid, retrying once:", (firstErr as Error).message);
    coderResponse = await provider.complete({
      system: CODER_PROMPT,
      messages: [
        { role: "user", content: coderUserContent },
        { role: "assistant", content: coderResponse.text },
        {
          role: "user",
          content:
            `Your previous response could not be used: ${(firstErr as Error).message}\n\n` +
            "Respond again with ONLY the complete JSON object, strictly valid JSON. Escape newlines " +
            "as backslash-n, double quotes as backslash-quote, and every literal backslash as two backslashes.",
        },
      ],
      maxTokens: 8000,
    });
    coderTokens += coderResponse.tokensUsed;
    try {
      generated = extensionGenerationSchema.parse(extractJson(coderResponse.text));
    } catch (err) {
      throw new AiResponseValidationError(
        `Coder response failed validation after retry: ${(err as Error).message}`,
        coderResponse.text
      );
    }
  }

  return {
    result: generated,
    tokensUsed: architectResponse.tokensUsed + coderTokens,
    model: coderResponse.model,
  };
}

interface ModifyExtensionResult {
  result: ExtensionModificationResult;
  tokensUsed: number;
  model: string;
}

/**
 * Spec section 10: chat-driven modification. Only sends the AI the current
 * file tree + full content of files (keeps prompts bounded even for larger
 * projects) plus recent chat history, and asks for a targeted diff rather
 * than a full regeneration.
 */
export async function modifyExtension(params: {
  userMessage: string;
  files: ProjectFile[];
  recentMessages: { role: "user" | "assistant"; content: string }[];
}): Promise<ModifyExtensionResult> {
  const provider = getAiProvider();

  const fileTree = params.files.map((f) => f.path).join("\n");
  const filesBlock = params.files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const historyBlock = params.recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const userContent = [
    `Current file tree:\n${fileTree}`,
    `Current file contents:\n${filesBlock}`,
    historyBlock ? `Recent conversation:\n${historyBlock}` : "",
    `User request: ${params.userMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await provider.complete({
    system: MODIFIER_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 8000,
  });

  let result;
  try {
    result = extensionModificationSchema.parse(extractJson(response.text));
  } catch (err) {
    throw new AiResponseValidationError(
      `Modifier response failed validation: ${(err as Error).message}`,
      response.text
    );
  }

  return { result, tokensUsed: response.tokensUsed, model: response.model };
}

/** Spec section 33 "Reviewer": audits an existing project's files. */
export async function analyzeExtension(
  files: ProjectFile[]
): Promise<{ result: ExtensionAnalysisResult; tokensUsed: number }> {
  const provider = getAiProvider();
  const filesBlock = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

  const response = await provider.complete({
    system: REVIEWER_PROMPT,
    messages: [{ role: "user", content: filesBlock }],
    maxTokens: 2000,
  });

  let result;
  try {
    result = extensionAnalysisSchema.parse(extractJson(response.text));
  } catch (err) {
    throw new AiResponseValidationError(
      `Reviewer response failed validation: ${(err as Error).message}`,
      response.text
    );
  }

  return { result, tokensUsed: response.tokensUsed };
}

/** Spec section 16 "Tester": produces a static test plan, never claims execution. */
export async function generateTests(
  files: ProjectFile[]
): Promise<{ result: TestPlanResult; tokensUsed: number }> {
  const provider = getAiProvider();
  const filesBlock = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

  const response = await provider.complete({
    system: TESTER_PROMPT,
    messages: [{ role: "user", content: filesBlock }],
    maxTokens: 2000,
  });

  let result;
  try {
    result = testPlanSchema.parse(extractJson(response.text));
  } catch (err) {
    throw new AiResponseValidationError(
      `Tester response failed validation: ${(err as Error).message}`,
      response.text
    );
  }

  return { result, tokensUsed: response.tokensUsed };
}
