import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { validateProject } from "@/lib/validator";
import { getOwnedProject, getProjectFiles } from "@/lib/firebase/firestore";

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

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const files = await getProjectFiles(projectId);
  const result = validateProject(files);
  return NextResponse.json({ result });
}
