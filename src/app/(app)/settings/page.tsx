import { getSession } from "@/lib/firebase/session";
import { getProfile } from "@/lib/firebase/firestore";
import { getUsage } from "@/lib/usage";

export default async function SettingsPage() {
  const session = await getSession();
  const profile = await getProfile(session!.uid);
  const usage = await getUsage(session!.uid, profile?.plan ?? "free");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Settings</h1>

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
        <p className="mt-3 text-xs text-ink-dim">
          Billing via Stripe is planned but not wired up in this build — upgrading a plan here would
          not currently charge a card. See ROADMAP.md.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-ink-line bg-ink-raised p-5">
        <h2 className="text-sm font-medium">GitHub</h2>
        <p className="mt-2 text-sm text-ink-dim">
          Exporting a project straight to a new GitHub repository is planned for a later phase. For
          now, download the ZIP and push it yourself.
        </p>
        <button
          disabled
          className="mt-3 cursor-not-allowed rounded-full border border-ink-line px-4 py-2 text-sm text-ink-dim opacity-60"
        >
          Connect GitHub (coming soon)
        </button>
      </section>
    </div>
  );
}
