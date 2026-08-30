import { adminDb } from "@/lib/firebase/admin";

/**
 * Spec section 24's event list, exactly as named there. Keeping this as a
 * union (rather than a bare string) means adding a new call site is a
 * one-line, type-checked change, and a typo in an event name is a build
 * error instead of a silent no-op in a dashboard somewhere.
 */
export type AnalyticsEvent =
  | "signup"
  | "project_created"
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "preview_opened"
  | "download_clicked"
  | "github_connected"
  | "upgrade_clicked";

/**
 * Fire-and-forget event tracking. No analytics provider is wired in yet
 * (see ROADMAP.md) — events are written to a `analytics_events` Firestore
 * collection so the *shape* of instrumentation is real and queryable, and
 * swapping in PostHog/Segment/Amplitude later is a matter of adding a
 * second sink here, not re-instrumenting every call site.
 *
 * Per spec section 24 ("No almacenar contenido privado innecesario"),
 * `properties` should only ever contain small, non-sensitive fields (IDs,
 * enums, counts) — never prompt text, file contents, or tokens.
 */
export async function track(
  event: AnalyticsEvent,
  uid: string | null,
  properties: Record<string, string | number | boolean> = {}
): Promise<void> {
  try {
    await adminDb().collection("analytics_events").add({
      event,
      uid,
      properties,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Analytics must never break the request it's attached to.
  }
}
