import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { generateTests } from "@/lib/ai/extension";
import { getDefaultModelForRecording } from "@/lib/ai";
import { getUsage, recordUsage } from "@/lib/usage";
import { toFriendlyError } from "@/lib/errors";
import {
  completeGeneration,
  createGeneration,
  getOwnedProject,
  getProfile,
  getProjectFiles,
} from "@/lib/firebase/firestore";

const TEST_GENERATION_COST = 1;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
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
  const model = process.env.AI_MODEL ?? getDefaultModelForRecording();
  const generationId = await createGeneration(projectId, session.uid, "tests", "Generate test plan", model);

  try {
    const { result, tokensUsed } = await generateTests(files);

    await completeGeneration(projectId, generationId, { status: "success", tokensUsed });
    await recordUsage(session.uid, TEST_GENERATION_COST);

    return NextResponse.json({ result });
  } catch (err) {
    await completeGeneration(projectId, generationId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toFriendlyError(err, "We couldn't generate a test plan right now. Please try again."),
      { status: 500 }
    );
  }
}
