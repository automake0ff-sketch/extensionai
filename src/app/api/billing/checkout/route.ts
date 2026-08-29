import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/session";
import { getProfile, updateProfileBilling } from "@/lib/firebase/firestore";
import { getStripeClient, priceIdForPlan, type BillablePlan } from "@/lib/stripe/client";
import { toFriendlyError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const plan = body?.plan as BillablePlan | undefined;
  if (plan !== "pro" && plan !== "pro_plus") {
    return NextResponse.json({ error: 'plan must be "pro" or "pro_plus".' }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const profile = await getProfile(session.uid);

    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email ?? undefined,
        metadata: { uid: session.uid },
      });
      customerId = customer.id;
      await updateProfileBilling(session.uid, { stripeCustomerId: customerId });
    }

    const origin = new URL(request.url).origin;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      success_url: `${origin}/settings?checkout=success`,
      cancel_url: `${origin}/settings?checkout=cancelled`,
      // Read by the webhook (checkout.session.completed) to know which plan
      // to apply and to whom, without needing to look up price IDs there.
      metadata: { uid: session.uid, plan },
      subscription_data: { metadata: { uid: session.uid, plan } },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    return NextResponse.json(
      toFriendlyError(err, "We couldn't start checkout right now. Please try again."),
      { status: 500 }
    );
  }
}
