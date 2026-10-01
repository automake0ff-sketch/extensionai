import { getSession } from "@/lib/firebase/session";
import { getGithubConnection, getProfile, getWaitlistStats } from "@/lib/firebase/firestore";
import { getUsage } from "@/lib/usage";
import { isAdminEmail } from "@/lib/admin";
import { GithubConnectionCard } from "@/components/app/github-connection-card";
import { BillingSection } from "@/components/app/billing-section";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ githubConnected?: string; githubError?: string; checkout?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const profile = await getProfile(session!.uid);
  const usage = await getUsage(session!.uid, profile?.plan ?? "free");
  const githubConnection = await getGithubConnection(session!.uid);
  const showAdmin = isAdminEmail(session!.email);
  const waitlistStats = showAdmin ? await getWaitlistStats() : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Settings</h1>

      {params.githubConnected && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> GitHub connected successfully.
        </div>
      )}
      {params.githubError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          <XCircle className="h-4 w-4 shrink-0" /> {decodeURIComponent(params.githubError)}
        </div>
      )}
      {params.checkout === "success" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Subscription started — it may take a moment to reflect below.
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-ink-line bg-ink-raised p-5">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="mt-2 text-sm text-ink-dim">{session!.email}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-ink-line bg-ink-raised p-5">
        <h2 className="text-sm font-medium">Plan &amp; usage</h2>
        <p className="mt-2 text-sm capitalize">{(profile?.plan ?? "free").replace("_", "+")} plan</p>
        <p className="mt-1 text-sm text-ink-dim">
          {usage.used} / {usage.limit} AI credits used this period
        </p>
        <BillingSection currentPlan={profile?.plan ?? "free"} />
      </section>

      <GithubConnectionCard githubLogin={githubConnection?.githubLogin ?? null} />

      {showAdmin && waitlistStats && (
        <section className="mt-4 rounded-2xl border border-ink-line bg-ink-raised p-5">
          <h2 className="text-sm font-medium">Waitlist (admin only)</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-ink-line bg-ink px-3 py-4">
              <p className="text-2xl font-semibold">{waitlistStats.total}</p>
              <p className="mt-1 text-xs text-ink-dim">Total</p>
            </div>
            <div className="rounded-xl border border-ink-line bg-ink px-3 py-4">
              <p className="text-2xl font-semibold">{waitlistStats.pending}</p>
              <p className="mt-1 text-xs text-ink-dim">Pending</p>
            </div>
            <div className="rounded-xl border border-ink-line bg-ink px-3 py-4">
              <p className="text-2xl font-semibold">{waitlistStats.approved}</p>
              <p className="mt-1 text-xs text-ink-dim">Approved</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-dim">
            Visible only to admin emails (ADMIN_EMAILS). Approve someone by setting their{" "}
            <code>waitlist/&#123;email&#125;</code> doc&apos;s <code>status</code> to{" "}
            <code>&quot;approved&quot;</code> in Firestore, or add them to BETA_ALLOWED_EMAILS.
          </p>
        </section>
      )}
    </div>
  );
}
