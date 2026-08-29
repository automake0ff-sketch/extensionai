import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/firebase/session";
import { buildAuthorizeUrl } from "@/lib/github/client";

const STATE_COOKIE = "github_oauth_state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?redirectTo=/settings", request.url));
  }

  if (!process.env.GITHUB_OAUTH_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/settings?githubError=GitHub+export+is+not+configured+on+this+deployment.", request.url)
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/github/callback", request.url).toString();
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
