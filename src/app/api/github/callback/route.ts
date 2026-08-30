import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/firebase/session";
import { exchangeCodeForToken, getAuthenticatedGitHubUser } from "@/lib/github/client";
import { saveGithubConnection } from "@/lib/firebase/firestore";
import { encryptSecret } from "@/lib/crypto";
import { track } from "@/lib/analytics";

const STATE_COOKIE = "github_oauth_state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/settings?githubError=That+GitHub+authorization+request+expired+or+was+invalid.+Please+try+again.", request.url)
    );
  }

  try {
    const redirectUri = new URL("/api/github/callback", request.url).toString();
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const githubUser = await getAuthenticatedGitHubUser(accessToken);

    await saveGithubConnection(session.uid, {
      githubLogin: githubUser.login,
      encryptedAccessToken: encryptSecret(accessToken),
    });
    track("github_connected", session.uid, {});

    const response = NextResponse.redirect(new URL("/settings?githubConnected=true", request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?githubError=We+couldn%27t+connect+your+GitHub+account.+Please+try+again.", request.url)
    );
  }
}
