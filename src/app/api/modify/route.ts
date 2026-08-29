import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { AiResponseValidationError, modifyExtension } from "@/lib/ai/extension";
import { getUsage, recordUsage } from "@/lib/usage";
import { toFriendlyError } from "@/lib/errors";
import {
  addChatMessage,
  completeGeneration,
  createGeneration,
  deleteProjectFileByPath,
  getOwnedProject,
  getProfile,
  getProjectFileByPath,
  getProjectFiles,
  listChatMessages,
  snapshotFileVersion,
  updateProject,
  upsertProjectFile,
} from "@/lib/firebase/firestore";

const MODIFICATION_COST = 1;
const MAX_HISTORY_MESSAGES = 10;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
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

    for (const change of result.changes) {
      const existing = await getProjectFileByPath(projectId, change.path);

      // Snapshot the previous version before mutating (spec section 11/12).
      if (existing) {
        await snapshotFileVersion(projectId, change.path, existing.content, "ai");
      }

      if (change.action === "delete") {
        await deleteProjectFileByPath(projectId, change.path);
      } else {
        await upsertProjectFile(projectId, change.path, change.content ?? "");
      }
    }

    await completeGeneration(projectId, generationId, {
      status: "success",
      tokensUsed,
      model: usedModel,
    });

    await recordUsage(session.uid, MODIFICATION_COST);
    await addChatMessage(projectId, session.uid, "assistant", result.message);
    await updateProject(projectId, { status: "ready" });

    const updatedFiles = await getProjectFiles(projectId);

    return NextResponse.json({ result, files: updatedFiles });
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
          : "We couldn't apply that change. Please try again."
      ),
      { status: 500 }
    );
  }
}
