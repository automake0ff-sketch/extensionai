import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { analyzeExtension } from "@/lib/ai/extension";
import { toFriendlyError } from "@/lib/errors";
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

  try {
    const { result } = await analyzeExtension(files);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      toFriendlyError(err, "We couldn't analyze this project right now. Please try again."),
      { status: 500 }
    );
  }
}
