import { getUsageDoc, incrementUsage } from "@/lib/firebase/firestore";

export const PLAN_CREDITS: Record<string, number> = {
  free: 20,
  pro: 300,
  pro_plus: 1000,
};

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns how many credits the user has used this period and their plan
 * limit. Does not itself block the request — callers decide what to do
 * when the limit is reached (spec section 21 says payments aren't required
 * for the MVP, only the accounting).
 */
export async function getUsage(
  uid: string,
  plan: string
): Promise<{ used: number; limit: number; period: string }> {
  const period = currentPeriod();
  const doc = await getUsageDoc(uid, period);

  return {
    used: doc?.creditsUsed ?? 0,
    limit: PLAN_CREDITS[plan] ?? PLAN_CREDITS.free,
    period,
  };
}

/** Increments the usage counter for the current period (creates the doc if needed). */
export async function recordUsage(uid: string, credits: number): Promise<void> {
  const period = currentPeriod();
  await incrementUsage(uid, period, credits);
}
