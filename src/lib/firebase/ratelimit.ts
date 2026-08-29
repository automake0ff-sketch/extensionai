import { adminDb } from "./admin";

/**
 * Simple fixed-window rate limiter backed by Firestore, so it works
 * correctly across serverless instances (an in-memory counter would reset
 * per instance and give a false sense of protection). Not meant to defend
 * against a determined attacker with many identities — it's here to stop
 * accidental hammering (double-clicks, retry loops, runaway scripts) from
 * burning through AI credits or spamming the provider.
 */
export async function checkRateLimit(
  uid: string,
  key: string,
  { windowMs, max }: { windowMs: number; max: number }
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const ref = adminDb().collection("rateLimits").doc(`${uid}_${key}`);
  const now = Date.now();

  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;

    if (!data || now - data.windowStart >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return { allowed: true };
    }

    if (data.count >= max) {
      return { allowed: false, retryAfterMs: data.windowStart + windowMs - now };
    }

    tx.update(ref, { count: data.count + 1 });
    return { allowed: true };
  });
}
