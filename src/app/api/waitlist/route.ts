import { NextResponse } from "next/server";
import { joinWaitlist } from "@/lib/firebase/firestore";
import { checkRateLimit } from "@/lib/firebase/ratelimit";
import { toFriendlyError } from "@/lib/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public — no session required. Rate-limited by IP-ish proxy (there's no
 * authenticated uid to key off of here, so we key off the email itself,
 * which still stops a script from hammering the same address repeatedly;
 * a determined attacker rotating emails isn't meaningfully slowed down by
 * this alone, same caveat as the rest of the rate limiter — see
 * SECURITY.md).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const niche = typeof body?.niche === "string" ? body.niche.trim().slice(0, 200) : undefined;

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(email.toLowerCase(), "waitlist-join", {
    windowMs: 60_000,
    max: 3,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Please try again in a moment." }, { status: 429 });
  }

  try {
    const { alreadyOnList } = await joinWaitlist(email, { niche });
    return NextResponse.json({ ok: true, alreadyOnList });
  } catch (err) {
    return NextResponse.json(
      toFriendlyError(err, "We couldn't add you to the waitlist right now. Please try again."),
      { status: 500 }
    );
  }
}
