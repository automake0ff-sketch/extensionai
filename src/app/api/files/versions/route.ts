import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { getOwnedProject, listFileVersions } from "@/lib/firebase/firestore";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const path = searchParams.get("path");

  if (!projectId || !path) {
    return NextResponse.json({ error: "projectId and path are required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const versions = await listFileVersions(projectId, path);
  return NextResponse.json({ versions });
}
