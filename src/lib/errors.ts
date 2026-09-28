/**
 * Wraps an internal error into a response shape the UI can show safely:
 * a friendly one-liner plus optional technical detail behind a toggle.
 * Never leak raw stack traces / connection errors straight to the user.
 */
export function toFriendlyError(err: unknown, friendlyMessage: string) {
  const technical = err instanceof Error ? err.message : String(err);
  // Log the real cause server-side so it shows up in Vercel runtime logs.
  // Without this, routes that catch and return a generic 500 leave no trace
  // of why they failed (the detail only lives in the response body).
  console.error("[api-error]", friendlyMessage, "|", err instanceof Error ? (err.stack ?? err.message) : String(err));
  return { error: friendlyMessage, technicalDetails: technical };
}
