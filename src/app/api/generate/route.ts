import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { AiResponseValidationError, generateExtension } from "@/lib/ai/extension";
import { DEFAULT_AI_MODEL } from "@/lib/ai";
import { getUsage, recordUsage } from "@/lib/usage";
import { toFriendlyError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/firebase/ratelimit";
import { assertWithinProjectLimits, ProjectLimitError } from "@/lib/limits";
import { track } from "@/lib/analytics";
import {
  addChatMessage,
  completeGeneration,
  createGeneration,
  getOwnedProject,
  getProfile,
  replaceProjectFiles,
  updateProject,
} from "@/lib/firebase/firestore";

// One credit per generation for the MVP (spec section 21 doesn't mandate a
// precise formula, just that usage is tracked and bounded).
const GENERATION_COST = 1;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(session.uid, "generate", { windowMs: 60_000, max: 5 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You're generating extensions too quickly. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const prompt = body?.prompt as string | undefined;

  if (!projectId || !prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "A project and a description of the extension are required." },
      { status: 400 }
    );
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

  await updateProject(projectId, { status: "generating" });

  const model = process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
  const generationId = await createGeneration(projectId, session.uid, "generate", prompt, model);
  track("generation_started", session.uid, { projectId, kind: "generate" });

  try {
    const { result, tokensUsed, model: usedModel } = await generateExtension(prompt);

    assertWithinProjectLimits(result.files);

    await replaceProjectFiles(projectId, result.files);

    await updateProject(projectId, {
      status: "ready",
      name: result.name || project.name,
      description: result.description || project.description,
    });

    await completeGeneration(projectId, generationId, {
      status: "success",
      tokensUsed,
      model: usedModel,
    });

    await recordUsage(session.uid, GENERATION_COST);
    track("generation_completed", session.uid, { projectId, kind: "generate", fileCount: result.files.length });

    await addChatMessage(projectId, session.uid, "user", prompt);
    await addChatMessage(
      projectId,
      session.uid,
      "assistant",
      `Your extension "${result.name}" is ready. I created ${result.files.length} file(s): ${result.files
        .map((f) => f.path)
        .join(", ")}.`
    );

    return NextResponse.json({ project: { ...project, status: "ready" }, result });
  } catch (err) {
    await updateProject(projectId, { status: "error" });
    await completeGeneration(projectId, generationId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    track("generation_failed", session.uid, { projectId, kind: "generate" });

    const isValidation = err instanceof AiResponseValidationError;
    const isLimit = err instanceof ProjectLimitError;
    return NextResponse.json(
      isLimit
        ? { error: err.message }
        : toFriendlyError(
            err,
            isValidation
              ? "The AI produced an invalid extension structure. Please try rephrasing your request."
              : "We couldn't generate your extension. Please try again."
          ),
      { status: isLimit ? 400 : 500 }
    );
  }
}
