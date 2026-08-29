import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import {
  getFileVersionById,
  getOwnedProject,
  getProjectFileByPath,
  snapshotFileVersion,
  upsertProjectFile,
} from "@/lib/firebase/firestore";

/**
 * Restores a file to a previous version. The *current* content is snapshotted
 * first (so restoring is itself undoable), then the old content is written
 * back as the current content of the file.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const versionId = body?.versionId as string | undefined;

  if (!projectId || !versionId) {
    return NextResponse.json({ error: "projectId and versionId are required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const version = await getFileVersionById(projectId, versionId);
  if (!version) {
    return NextResponse.json({ error: "That version no longer exists." }, { status: 404 });
  }

  const current = await getProjectFileByPath(projectId, version.path);
  if (current) {
    await snapshotFileVersion(projectId, version.path, current.content, "user");
  }

  await upsertProjectFile(projectId, version.path, version.content);

  return NextResponse.json({ ok: true, path: version.path, content: version.content });
}
