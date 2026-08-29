import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session";

const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Exchanges a Firebase ID token (obtained client-side right after
 * sign-in/sign-up) for an httpOnly session cookie, and makes sure a
 * `profiles/{uid}` document exists. This is the Firestore equivalent of the
 * Postgres `handle_new_user` trigger from the previous Supabase schema —
 * Firestore has no server-side triggers reachable from plain document
 * writes, so we do it here instead.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken as string | undefined;

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const profileRef = adminDb().collection("profiles").doc(decoded.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      await profileRef.set({
        id: decoded.uid,
        email: decoded.email ?? "",
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
        plan: "free",
        createdAt: new Date().toISOString(),
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not establish a session." }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
