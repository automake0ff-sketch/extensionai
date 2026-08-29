import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { validateProject } from "@/lib/validator";
import { getOwnedProject, getProjectFiles } from "@/lib/firebase/firestore";

/**
 * Spec section 18: "Prepare for Chrome Web Store" does NOT publish anything —
 * automated publishing is explicitly out of scope for the MVP (P2). This
 * builds the checklist/metadata a developer needs to publish manually.
 */
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
  const manifestFile = files.find((f) => f.path === "manifest.json");
  const validation = validateProject(files);

  let permissions: string[] = [];
  let hostPermissions: string[] = [];
  if (manifestFile) {
    try {
      const manifest = JSON.parse(manifestFile.content);
      permissions = manifest.permissions ?? [];
      hostPermissions = manifest.host_permissions ?? [];
    } catch {
      // Already reported by the validator above.
    }
  }

  return NextResponse.json({
    name: project.name,
    description: project.description,
    suggestedCategory: "Productivity",
    permissionsExplained: [...permissions, ...hostPermissions].map((p) => ({
      permission: p,
      explanation: `Used by the extension — confirm and describe why "${p}" is needed for your Chrome Web Store listing.`,
    })),
    privacyNotes: [
      "Chrome Web Store requires a privacy policy URL if your extension handles user data.",
      "Disclose any data collection, even if only stored locally via chrome.storage.",
    ],
    checklist: [
      { label: "Extension passes validation with no errors", done: validation.valid },
      { label: "Icons (16/48/128px) added to the project", done: false },
      { label: "At least one 1280x800 or 640x400 screenshot prepared", done: false },
      { label: "Privacy policy URL ready (if applicable)", done: false },
      { label: "Store listing description written (up to 132 chars short + full description)", done: false },
      { label: "Developer account registered at chrome.google.com/webstore/devconsole", done: false },
    ],
    screenshotPlaceholders: [
      { label: "Screenshot 1 — main popup view", size: "1280x800" },
      { label: "Screenshot 2 — extension in action on a real page", size: "1280x800" },
    ],
    validation,
  });
}
