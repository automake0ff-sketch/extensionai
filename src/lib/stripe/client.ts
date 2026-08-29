import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Server-only Stripe client. Spec section 20/21: the architecture must
 * support billing even though the MVP doesn't require it to be fully wired
 * up. This IS fully wired up — checkout, the billing portal, and the
 * webhook that reconciles subscription state all work — but nothing in this
 * repository has been exercised against a real Stripe account, so treat it
 * as a solid starting point to test against your own account rather than a
 * production-hardened integration.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set (see .env.example).");
  }

  cachedClient = new Stripe(secretKey);
  return cachedClient;
}

export type BillablePlan = "pro" | "pro_plus";

export function priceIdForPlan(plan: BillablePlan): string {
  const envVar = plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_PRO_PLUS";
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not set (see .env.example) — create the price in your Stripe dashboard first.`);
  }
  return priceId;
}
