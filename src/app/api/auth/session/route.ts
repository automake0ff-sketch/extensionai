import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session";
import { isEmailApproved } from "@/lib/firebase/firestore";
import { track } from "@/lib/analytics";

const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Closed beta gate: while WAITLIST_GATE_ENABLED isn't explicitly "false",
 * a brand-new account can only be created if the email is either in
 * BETA_ALLOWED_EMAILS (comma-separated, for your own testing) or has an
 * "approved" doc in the `waitlist` Firestore collection (flip a pending
 * entry's status manually in the console — no admin UI yet).
 *
 * Existing accounts are never re-checked here — once someone has a
 * `profiles/{uid}` doc, they keep access regardless of later waitlist
 * changes. Turn the whole gate off later by setting
 * WAITLIST_GATE_ENABLED=false, no code change needed.
 */
async function isAllowedDuringBeta(email: string): Promise<boolean> {
  if (process.env.WAITLIST_GATE_ENABLED === "false") return true;

  const allowedEmails = (process.env.BETA_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.includes(email.trim().toLowerCase())) return true;

  return isEmailApproved(email);
}

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

    const profileRef = adminDb().collection("profiles").doc(decoded.uid);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      const email = decoded.email ?? "";
      if (!(await isAllowedDuringBeta(email))) {
        return NextResponse.json(
          {
            error: "waitlist",
            message:
              "ExtenAI is in closed beta right now. You're welcome to join the waitlist and we'll email you when you're approved.",
          },
          { status: 403 }
        );
      }

      await profileRef.set({
        id: decoded.uid,
        email,
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
        plan: "free",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: new Date().toISOString(),
      });
      track("signup", decoded.uid, {});
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

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
