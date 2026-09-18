import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { analyzeExtension } from "@/lib/ai/extension";
import { toFriendlyError } from "@/lib/errors";
import { getUsage, recordUsage } from "@/lib/usage";
import { checkRateLimit } from "@/lib/firebase/ratelimit";
import { getDefaultModelForRecording } from "@/lib/ai";
import {
  completeGeneration,
  createGeneration,
  getOwnedProject,
  getProfile,
  getProjectFiles,
} from "@/lib/firebase/firestore";

const ANALYSIS_COST = 1;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(session.uid, "analyze", { windowMs: 60_000, max: 10 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You're running reviews too quickly. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  if (!projectId) {
    return NextResponse.json({ error: "A project id is required." }, { status: 400 });
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
  const generationId = await createGeneration(
    projectId,
    session.uid,
    "analyze",
    "Run AI review",
    process.env.AI_MODEL ?? getDefaultModelForRecording()
  );

  try {
    const { result, tokensUsed } = await analyzeExtension(files);

    await completeGeneration(projectId, generationId, { status: "success", tokensUsed });
    await recordUsage(session.uid, ANALYSIS_COST);

    return NextResponse.json({ result });
  } catch (err) {
    await completeGeneration(projectId, generationId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toFriendlyError(err, "We couldn't analyze this project right now. Please try again."),
      { status: 500 }
    );
  }
}
