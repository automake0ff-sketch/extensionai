import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { AiResponseValidationError, modifyExtension } from "@/lib/ai/extension";
import { getUsage, recordUsage } from "@/lib/usage";
import { toFriendlyError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/firebase/ratelimit";
import {
  addChatMessage,
  completeGeneration,
  createGeneration,
  getOwnedProject,
  getProfile,
  getProjectFiles,
  listChatMessages,
  markGenerationPendingReview,
} from "@/lib/firebase/firestore";

const MAX_HISTORY_MESSAGES = 10;

/**
 * Proposes a change but does NOT apply it (spec section 11: Accept/Reject).
 * The AI credit is spent here, since the AI work already happened — accepting
 * or discarding only decides whether the *files* get touched, via
 * POST /api/modify/apply or POST /api/modify/discard.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(session.uid, "modify", { windowMs: 60_000, max: 10 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You're sending changes too quickly. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const message = body?.message as string | undefined;

  if (!projectId || !message || !message.trim()) {
    return NextResponse.json({ error: "A message describing the change is required." }, { status: 400 });
  }

  const profile = await getProfile(session.uid);
  const usage = await getUsage(session.uid, profile?.plan ?? "free");
  if (usage.used >= usage.limit) {
    return NextResponse.json(
      { error: `You've used all ${usage.limit} AI credits for this period. Upgrade your plan to continue.` },
      { status: 402 }
    );
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const files = await getProjectFiles(projectId);
  const history = await listChatMessages(projectId, MAX_HISTORY_MESSAGES);

  const model = process.env.AI_MODEL ?? "claude-sonnet-4-6";
  const generationId = await createGeneration(projectId, session.uid, "modify", message, model);

  await addChatMessage(projectId, session.uid, "user", message);

  try {
    const { result, tokensUsed, model: usedModel } = await modifyExtension({
      userMessage: message,
      files,
      recentMessages: history
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        .filter((m) => m.role === "user" || m.role === "assistant"),
    });

    await markGenerationPendingReview(projectId, generationId, {
      tokensUsed,
      model: usedModel,
      message: result.message,
      changes: result.changes,
    });

    // Credit is spent when the AI call happens, not when the person decides
    // whether to keep it — the work (and the tokens) already happened.
    await recordUsage(session.uid, 1);

    return NextResponse.json({ generationId, result });
  } catch (err) {
    await completeGeneration(projectId, generationId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    const isValidation = err instanceof AiResponseValidationError;
    return NextResponse.json(
      toFriendlyError(
        err,
        isValidation
          ? "The AI produced an invalid set of changes. Please try rephrasing your request."
          : "We couldn't propose that change. Please try again."
      ),
      { status: 500 }
    );
  }
}
