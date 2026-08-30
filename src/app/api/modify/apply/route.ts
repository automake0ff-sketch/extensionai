import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import {
  addChatMessage,
  deleteProjectFileByPath,
  getOwnedProject,
  getPendingGeneration,
  getProjectFileByPath,
  getProjectFiles,
  resolveGeneration,
  snapshotFileVersion,
  updateProject,
  upsertProjectFile,
} from "@/lib/firebase/firestore";
import { assertChangesWithinProjectLimits, ProjectLimitError } from "@/lib/limits";

/** The person clicked "Accept" on a proposed change — apply it now. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const generationId = body?.generationId as string | undefined;

  if (!projectId || !generationId) {
    return NextResponse.json({ error: "projectId and generationId are required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const pending = await getPendingGeneration(projectId, generationId);
  if (!pending) {
    return NextResponse.json(
      { error: "This proposed change is no longer available (it may have already been applied or discarded)." },
      { status: 404 }
    );
  }

  try {
    const currentFiles = await getProjectFiles(projectId);
    assertChangesWithinProjectLimits(currentFiles, pending.pendingChanges);

    for (const change of pending.pendingChanges) {
      const existing = currentFiles.find((f) => f.path === change.path) ?? (await getProjectFileByPath(projectId, change.path));

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

    await resolveGeneration(projectId, generationId, "success");
    await addChatMessage(projectId, session.uid, "assistant", pending.pendingMessage);
    await updateProject(projectId, { status: "ready" });

    const files = await getProjectFiles(projectId);
    return NextResponse.json({ files });
  } catch (err) {
    if (err instanceof ProjectLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "We couldn't apply that change. Please try again." }, { status: 500 });
  }
}
