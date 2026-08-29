import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { buildExtensionZip, slugifyFilename } from "@/lib/zip/build";
import { validateProject } from "@/lib/validator";
import { getOwnedProject, getProjectFiles } from "@/lib/firebase/firestore";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const force = searchParams.get("force") === "true";
  if (!projectId) {
    return NextResponse.json({ error: "A project id is required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const files = await getProjectFiles(projectId);
  if (files.length === 0) {
    return NextResponse.json({ error: "This project has no files to export yet." }, { status: 400 });
  }

  // Spec section 15: run the validator before export. Errors block the
  // download unless the person explicitly confirms via ?force=true — this
  // closes the gap noted in earlier versions of SECURITY.md/ROADMAP.md,
  // where the validator only warned and never actually blocked anything.
  const validation = validateProject(files);
  if (!validation.valid && !force) {
    return NextResponse.json(
      {
        error: "This extension has validation errors. Review them, or export anyway.",
        requiresConfirmation: true,
        validation,
      },
      { status: 409 }
    );
  }

  try {
    const buffer = await buildExtensionZip(project.name, files);
    const filename = `${slugifyFilename(project.name)}.zip`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "We couldn't build the ZIP file. Please try again." }, { status: 500 });
  }
}
