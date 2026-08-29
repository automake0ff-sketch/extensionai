import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { addChatMessage, getOwnedProject, getPendingGeneration, resolveGeneration } from "@/lib/firebase/firestore";

/** The person clicked "Reject" on a proposed change — discard it, files untouched. */
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

  await resolveGeneration(projectId, generationId, "discarded");
  await addChatMessage(projectId, session.uid, "assistant", "Discarded — no files were changed.");

  return NextResponse.json({ ok: true });
}
