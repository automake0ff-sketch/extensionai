import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { getProfile } from "@/lib/firebase/firestore";
import { getStripeClient } from "@/lib/stripe/client";
import { toFriendlyError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await getProfile(session.uid);
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found yet — upgrade a plan first." }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const origin = new URL(request.url).origin;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    return NextResponse.json(
      toFriendlyError(err, "We couldn't open the billing portal right now. Please try again."),
      { status: 500 }
    );
  }
}
