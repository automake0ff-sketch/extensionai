const GITHUB_API = "https://api.github.com";

class GitHubApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "GitHubApiError";
  }
}

async function githubFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(`GitHub API ${path} failed (${res.status}): ${body.slice(0, 300)}`, res.status);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// OAuth (web application flow)
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GITHUB_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri,
    scope: "repo",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GITHUB_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new GitHubApiError(`GitHub OAuth token exchange failed: ${JSON.stringify(data).slice(0, 300)}`, 401);
  }
  return data.access_token as string;
}

export async function getAuthenticatedGitHubUser(token: string): Promise<{ login: string }> {
  const data = await githubFetch("/user", token);
  return { login: data.login };
}

// ---------------------------------------------------------------------------
// Repository creation + a single atomic commit of every project file
// ---------------------------------------------------------------------------

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean
): Promise<{ owner: string; repo: string; htmlUrl: string; defaultBranch: string }> {
  const data = await githubFetch("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({ name, private: isPrivate, auto_init: true }),
  });
  return {
    owner: data.owner.login,
    repo: data.name,
    htmlUrl: data.html_url,
    defaultBranch: data.default_branch,
  };
}

/**
 * Writes every file in `files` as a single commit using the Git Data API
 * (blob -> tree -> commit -> ref update), rather than one REST "create file"
 * call per file, so the export shows up as one clean commit instead of N.
 */
export async function commitFiles(
  token: string,
  params: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: { path: string; content: string }[];
  }
): Promise<{ commitSha: string; htmlUrl: string }> {
  const { owner, repo, branch, message, files } = params;

  const ref = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await githubFetch(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = baseCommit.tree.sha;

  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await githubFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
      });
      return { path: file.path, sha: blob.sha };
    })
  );

  const newTree = await githubFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    }),
  });

  const newCommit = await githubFetch(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });

  await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return {
    commitSha: newCommit.sha,
    htmlUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example).`);
  return value;
}

export { GitHubApiError };
