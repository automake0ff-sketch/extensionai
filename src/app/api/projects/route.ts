import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { createProject, listProjects } from "@/lib/firebase/firestore";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled extension";
  const description = typeof body?.description === "string" ? body.description : null;

  try {
    const project = await createProject(session.uid, { name, description });
    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "Could not create the project." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const projects = await listProjects(session.uid);
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ error: "Could not load projects." }, { status: 500 });
  }
}
