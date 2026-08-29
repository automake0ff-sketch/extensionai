import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import {
  getOwnedProject,
  getProjectFileByPath,
  snapshotFileVersion,
  upsertProjectFile,
} from "@/lib/firebase/firestore";

/** PATCH: manually edit a single file's content from the editor (spec section 9). */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const path = body?.path as string | undefined;
  const content = body?.content as string | undefined;

  if (!projectId || !path || content === undefined) {
    return NextResponse.json({ error: "projectId, path and content are required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const existing = await getProjectFileByPath(projectId, path);
  if (existing) {
    await snapshotFileVersion(projectId, path, existing.content, "user");
  }
  await upsertProjectFile(projectId, path, content);

  return NextResponse.json({ ok: true });
}
