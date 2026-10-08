import { getAiProvider } from "./index";
import { validateJsSyntax } from "@/lib/validator/js-syntax";
import { validateManifest } from "@/lib/validator/manifest";
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
// Vercel's serverless function limit is 300s. Reserve a slice of that for
// our own work (parsing, Firestore writes) and for round-trip overhead, and
// give the rest to whichever AI call is running -- rather than splitting it
// into two fixed per-call timeouts, which is what caused a real production
// failure: the free-tier model is sometimes slow, one call ran past a fixed
// 140s cap and the whole generation aborted with time to spare in the
// platform's actual 300s budget. Architect has consistently been fast in
// production logs (10-50s), so in the normal case this gives the Coder call
// (the slow, large one) nearly the whole budget instead of a fixed slice.
const TOTAL_BUDGET_MS = 280_000;
const MIN_CALL_TIMEOUT_MS = 20_000;
// Only attempt the Coder retry if doing so would still leave it a
// meaningful amount of time -- a retry with a few seconds left is just
// going to time out again and burn the platform limit for nothing.
const MIN_RETRY_TIME_MS = 40_000;

export function remainingBudgetMs(startedAt: number): number {
  return Math.max(MIN_CALL_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - startedAt));
}

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

  // 3000 (was 2000): a free/less-disciplined model can still run long in
  // "notes" despite the prompt asking it not to, and a response truncated
  // before its JSON closes is a hard failure ("Unexpected end of JSON
  // input") with no way to salvage it -- more headroom makes that less
  // likely to happen in the first place, and the retry below is the
  // fallback for when it does anyway.
  let architectResponse = await provider.complete({
    system: ARCHITECT_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 3000,
    timeoutMs: remainingBudgetMs(startedAt),
  });
  let architectTokens = architectResponse.tokensUsed;

  let plan;
  try {
    plan = architectPlanSchema.parse(extractJson(architectResponse.text));
  } catch (firstErr) {
    // Same one-retry-with-feedback pattern as the Coder step below: this
    // is the step that was missing it, and a truncated/malformed Architect
    // response is exactly as recoverable as a Coder one.
    if (remainingBudgetMs(startedAt) < MIN_RETRY_TIME_MS) {
      throw new AiResponseValidationError(
        `Architect response failed validation: ${(firstErr as Error).message}`,
        architectResponse.text
      );
    }
    console.warn("[generate] architect output invalid, retrying once:", (firstErr as Error).message);
    architectResponse = await provider.complete({
      system: ARCHITECT_PROMPT,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: architectResponse.text },
        {
          role: "user",
          content:
            `Your previous response could not be used: ${(firstErr as Error).message}\n\n` +
            "Respond again with ONLY the complete JSON object, strictly valid JSON, and keep " +
            "\"notes\" to at most 2 short sentences so the response finishes well within budget.",
        },
      ],
      maxTokens: 3000,
      timeoutMs: remainingBudgetMs(startedAt),
    });
    architectTokens += architectResponse.tokensUsed;
    try {
      plan = architectPlanSchema.parse(extractJson(architectResponse.text));
    } catch (err) {
      throw new AiResponseValidationError(
        `Architect response failed validation after retry: ${(err as Error).message}`,
        architectResponse.text
      );
    }
  }

  const coderUserContent = `User request: ${prompt}\n\nArchitect plan:\n${JSON.stringify(plan, null, 2)}`;

  let coderResponse = await provider.complete({
    system: CODER_PROMPT,
    messages: [{ role: "user", content: coderUserContent }],
    maxTokens: 8000,
    timeoutMs: remainingBudgetMs(startedAt),
  });
  let coderTokens = coderResponse.tokensUsed;

  // Up to 2 retries (3 attempts total), checking both that the response is
  // valid JSON AND that every .js file it contains actually parses as
  // JavaScript. The latter was a real gap: a schema-valid response can
  // still contain JS with a hard syntax error (confirmed in production: an
  // unquoted hyphenated object key, `needs-improvement: {...}`, parsed as
  // `needs - improvement` -- a SyntaxError that breaks the whole script),
  // and nothing used to catch that before it reached the user as a
  // generated extension that fails to even load in Chrome. Bumped from 1
  // retry to 2 now that reasoning is disabled: each attempt against the
  // small free fallback models typically takes 1-7s (confirmed in
  // production logs), so budget was never the constraint -- model
  // reliability was, and a cheap extra attempt measurably reduces the
  // "invalid extension structure" failure rate for a model this small.
  let generated: ExtensionGenerationResult | undefined;
  let lastFailure: { message: string; raw: string } | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      if (remainingBudgetMs(startedAt) < MIN_RETRY_TIME_MS) break;
      console.warn(`[generate] coder output invalid, retrying (attempt ${attempt + 1}/3):`, lastFailure!.message);
      coderResponse = await provider.complete({
        system: CODER_PROMPT,
        messages: [
          { role: "user", content: coderUserContent },
          { role: "assistant", content: coderResponse.text },
          {
            role: "user",
            content:
              `Your previous response could not be used: ${lastFailure!.message}\n\n` +
              "Respond again with ONLY the complete JSON object, strictly valid JSON. Escape newlines " +
              "as backslash-n, double quotes as backslash-quote, and every literal backslash as two " +
              "backslashes. Every .js file's \"content\" must also be syntactically valid JavaScript -- " +
              "in particular, object keys containing a hyphen (e.g. needs-improvement) MUST be quoted " +
              "as a string key, not written bare. The manifest.json file's \"content\" must itself " +
              "be valid JSON (no trailing commas, no comments, all strings double-quoted).",
          },
        ],
        maxTokens: 8000,
        timeoutMs: remainingBudgetMs(startedAt),
      });
      coderTokens += coderResponse.tokensUsed;
    }

    try {
      const candidate = extensionGenerationSchema.parse(extractJson(coderResponse.text));
      const syntaxIssues = validateJsSyntax(candidate.files);
      const manifestFile = candidate.files.find((f) => f.path === "manifest.json");
      // validateManifest's first (and only, when the JSON itself is broken)
      // issue is exactly "manifest.json is not valid JSON" -- confirmed as a
      // real production failure (Validate flagged it after a generation
      // that otherwise reported success). The schema above only checks that
      // manifest.json exists as a file with string content, never that the
      // content itself parses as JSON.
      // Errors only: validateManifest also emits "warning"-level notes
      // (e.g. broad permissions) that are advice for the user, not a reason
      // to throw the whole generation away and retry.
      const manifestIssues = manifestFile
        ? validateManifest(manifestFile.content).filter((i) => i.level === "error")
        : [];
      if (syntaxIssues.length > 0 || manifestIssues.length > 0) {
        throw new Error([...syntaxIssues, ...manifestIssues].map((i) => i.message).join("; "));
      }
      generated = candidate;
      break;
    } catch (err) {
      lastFailure = { message: (err as Error).message, raw: coderResponse.text };
    }
  }

  if (!generated) {
    throw new AiResponseValidationError(
      `Coder response failed validation: ${lastFailure!.message}`,
      lastFailure!.raw
    );
  }

  return {
    result: generated,
    tokensUsed: architectTokens + coderTokens,
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

  let response = await provider.complete({
    system: MODIFIER_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 8000,
  });
  let modifyTokens = response.tokensUsed;

  // Same reasoning as the Coder step in generateExtension(): a
  // schema-valid response can still contain a .js file with a hard
  // syntax error (e.g. an unquoted hyphenated object key), which would
  // otherwise reach the user as a chat edit that breaks their extension.
  let result: ExtensionModificationResult | undefined;
  let lastFailure: { message: string; raw: string } | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.warn(`[modify] response invalid, retrying (attempt ${attempt + 1}/3):`, lastFailure!.message);
      response = await provider.complete({
        system: MODIFIER_PROMPT,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: response.text },
          {
            role: "user",
            content:
              `Your previous response could not be used: ${lastFailure!.message}\n\n` +
              "Respond again with ONLY the complete JSON object, strictly valid JSON. Every changed " +
              ".js file's \"content\" must also be syntactically valid JavaScript -- in particular, " +
              "object keys containing a hyphen (e.g. needs-improvement) MUST be quoted as a string key. " +
              "If you changed manifest.json, its \"content\" must itself be valid JSON (no trailing " +
              "commas, no comments, all strings double-quoted).",
          },
        ],
        maxTokens: 8000,
      });
      modifyTokens += response.tokensUsed;
    }

    try {
      const candidate = extensionModificationSchema.parse(extractJson(response.text));
      const changedFiles = candidate.changes
        .filter((c): c is typeof c & { content: string } => c.action !== "delete" && !!c.content)
        .map((c) => ({ path: c.path, content: c.content }));
      const syntaxIssues = validateJsSyntax(changedFiles);
      // A chat edit that touches manifest.json can leave it as invalid JSON
      // (trailing comma, unescaped quote, etc.) -- this is the path that
      // most likely produced the "manifest.json is not valid JSON" error
      // the Validate button flagged in production. Only checked when the
      // edit actually changes manifest.json; edits that leave it alone
      // don't need it re-validated here.
      const manifestChange = changedFiles.find((f) => f.path === "manifest.json");
      const manifestIssues = manifestChange
        ? validateManifest(manifestChange.content).filter((i) => i.level === "error")
        : [];
      if (syntaxIssues.length > 0 || manifestIssues.length > 0) {
        throw new Error([...syntaxIssues, ...manifestIssues].map((i) => i.message).join("; "));
      }
      result = candidate;
      break;
    } catch (err) {
      lastFailure = { message: (err as Error).message, raw: response.text };
    }
  }

  if (!result) {
    throw new AiResponseValidationError(
      `Modifier response failed validation: ${lastFailure!.message}`,
      lastFailure!.raw
    );
  }

  return { result, tokensUsed: modifyTokens, model: response.model };
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
