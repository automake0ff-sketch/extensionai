/**
 * Wraps an internal error into a response shape the UI can show safely:
 * a friendly one-liner plus optional technical detail behind a toggle.
 * Never leak raw stack traces / connection errors straight to the user.
 */
export function toFriendlyError(err: unknown, friendlyMessage: string) {
  const technical = err instanceof Error ? err.message : String(err);
  return { error: friendlyMessage, technicalDetails: technical };
}
