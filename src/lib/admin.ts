/**
 * Admin allowlist, same pattern as BETA_ALLOWED_EMAILS in
 * src/app/api/auth/session/route.ts: comma-separated emails in an env var.
 * Deliberately separate from BETA_ALLOWED_EMAILS (which only gates account
 * *creation*) so that once the beta opens to more people, they don't all
 * automatically get admin-only views like the waitlist count.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
