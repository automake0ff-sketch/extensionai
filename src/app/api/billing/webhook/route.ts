import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getProfileByStripeCustomerId, updateProfileBilling } from "@/lib/firebase/firestore";
import type Stripe from "stripe";

/**
 * Reconciles Stripe subscription state into `profiles/{uid}`. Register this
 * endpoint's URL in the Stripe dashboard (or `stripe listen --forward-to`
 * locally) subscribed to at least: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const plan = session.metadata?.plan as "pro" | "pro_plus" | undefined;
      if (uid && plan) {
        await updateProfileBilling(uid, {
          plan,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const profile = await getProfileByStripeCustomerId(customerId);
      if (profile) {
        const stillActive = subscription.status === "active" || subscription.status === "trialing";
        const planFromMetadata = subscription.metadata?.plan as "pro" | "pro_plus" | undefined;
        await updateProfileBilling(profile.id, {
          plan: stillActive ? planFromMetadata ?? profile.plan : "free",
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const profile = await getProfileByStripeCustomerId(customerId);
      if (profile) {
        await updateProfileBilling(profile.id, { plan: "free", stripeSubscriptionId: null });
      }
      break;
    }

    default:
      // Other event types are intentionally ignored for the MVP.
      break;
  }

  return NextResponse.json({ received: true });
}
