import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { getWaitlistStats } from "@/lib/firebase/firestore";
import { isAdminEmail } from "@/lib/admin";
import { toFriendlyError } from "@/lib/errors";

/**
 * Admin-only. Returns 404 rather than 403 for both "not logged in" and
 * "logged in but not an admin" so the endpoint's existence isn't revealed
 * to non-admins poking at the API.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const stats = await getWaitlistStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      toFriendlyError(err, "Couldn't load waitlist stats."),
      { status: 500 }
    );
  }
}
