import { cookies } from "next/headers";
import { adminAuth } from "./admin";

export const SESSION_COOKIE_NAME = "__session";

export interface SessionUser {
  uid: string;
  email: string | null;
}

/**
 * Verifies the session cookie (set by POST /api/auth/session after a
 * successful client-side Firebase sign-in) and returns the authenticated
 * user, or null if there is no session or it's invalid/expired/revoked.
 * Safe to call from Server Components and Route Handlers.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

/** Like getSession(), but throws a 401-shaped error object for API routes that require auth. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated.");
    this.name = "UnauthorizedError";
  }
}
