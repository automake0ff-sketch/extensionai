import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session-cookie";

/**
 * Fast, edge-friendly redirect based on cookie *presence* only. This does
 * NOT verify the session cookie's signature/expiry — firebase-admin needs a
 * Node.js runtime, which this proxy may not run under. Real verification
 * happens server-side per request via getSession()/requireSession()
 * (src/lib/firebase/session.ts) in Server Components and Route Handlers, so
 * a forged/expired cookie can get past this redirect but never past an
 * actual data access.
 *
 * CRITICAL: this file must only ever import from "./session-cookie" for the
 * constant below, never from "./session" (which imports "./admin" i.e. the
 * full firebase-admin SDK). One of firebase-admin's transitive dependencies
 * does a require() of an ES module, which fails at runtime in whatever
 * restricted runtime this proxy executes under — and since the proxy runs
 * on every request, that failure takes down the entire app, public pages
 * included. This bit us once in production; don't reintroduce it.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const protectedPaths = ["/dashboard", "/projects", "/settings"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
