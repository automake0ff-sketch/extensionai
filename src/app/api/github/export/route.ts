import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { getGithubConnection, getOwnedProject, getProjectFiles } from "@/lib/firebase/firestore";
import { decryptSecret } from "@/lib/crypto";
import { commitFiles, createRepo, GitHubApiError } from "@/lib/github/client";
import { slugifyFilename } from "@/lib/zip/build";
import { toFriendlyError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const isPrivate = body?.private !== false; // default to private
  const requestedName = typeof body?.repoName === "string" ? body.repoName.trim() : "";

  if (!projectId) {
    return NextResponse.json({ error: "A project id is required." }, { status: 400 });
  }

  const project = await getOwnedProject(session.uid, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const connection = await getGithubConnection(session.uid);
  if (!connection) {
    return NextResponse.json(
      { error: "Connect your GitHub account first, from Settings." },
      { status: 400 }
    );
  }

  const files = await getProjectFiles(projectId);
  if (files.length === 0) {
    return NextResponse.json({ error: "This project has no files to export yet." }, { status: 400 });
  }

  const repoName = requestedName || slugifyFilename(project.name);

  try {
    const accessToken = decryptSecret(connection.encryptedAccessToken);
    const repo = await createRepo(accessToken, repoName, isPrivate);
    const commit = await commitFiles(accessToken, {
      owner: repo.owner,
      repo: repo.repo,
      branch: repo.defaultBranch,
      message: `Export ${project.name} from ExtenAI`,
      files: files.map((f) => ({ path: f.path, content: f.content })),
    });

    return NextResponse.json({ repoUrl: repo.htmlUrl, commitUrl: commit.htmlUrl });
  } catch (err) {
    const isConflict = err instanceof GitHubApiError && err.status === 422;
    return NextResponse.json(
      toFriendlyError(
        err,
        isConflict
          ? `A GitHub repository named "${repoName}" already exists on your account. Choose a different name.`
          : "We couldn't export this project to GitHub. Please try again."
      ),
      { status: isConflict ? 409 : 500 }
    );
  }
}
