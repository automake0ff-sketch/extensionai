import Link from "next/link";
import { ExtenAIMark } from "@/components/brand/mark";

export const metadata = { title: "Privacy Policy — ExtenAI" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <ExtenAIMark className="h-5 w-5 text-accent" />
        <span className="font-[family-name:var(--font-display)] font-semibold">ExtenAI</span>
      </Link>

      <div className="mb-8 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <strong>Draft template — not legal advice.</strong> The data inventory below matches what this
        codebase actually stores as of this build (see ARCHITECTURE.md), which makes it a solid
        starting point — but it still needs a lawyer&apos;s review for your jurisdiction (GDPR/CCPA
        applicability, a real data retention policy, your sub-processor list, a DPA if you sell to
        businesses, etc.) before launch, and needs updating any time the data you collect changes.
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-ink-dim">Last updated: [DATE — fill in at launch]</p>

      <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed text-ink-dim">
        <section>
          <h2 className="text-base font-medium text-ink-100">What we store</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account info: email address, and name/avatar if you sign in via Google or GitHub.</li>
            <li>
              Project content: the extensions you create — prompts, generated/edited file contents,
              chat messages, and version history — so the product can work (editing, version restore,
              re-generation).
            </li>
            <li>Usage metering: AI credit consumption per billing period.</li>
            <li>
              If you connect GitHub: your GitHub username and an OAuth access token (encrypted at
              rest) used only to create repositories on your behalf when you click &ldquo;Export to
              GitHub.&rdquo;
            </li>
            <li>
              If you subscribe to a paid plan: a Stripe customer/subscription ID. Card details are
              handled entirely by Stripe — we never see or store your card number.
            </li>
            <li>
              Product analytics: which features you use (e.g. that a project was created, or a ZIP was
              downloaded) — see the event list in ARCHITECTURE.md. We do not include prompt text or
              file contents in analytics events.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">Third parties we share data with</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Google Firebase</strong> — hosts our database (Firestore) and handles
              authentication.
            </li>
            <li>
              <strong>Anthropic</strong> (or the configured AI provider) — receives your prompts and
              project file contents to generate/modify extensions.
            </li>
            <li>
              <strong>Stripe</strong> — processes payments if you subscribe to a paid plan.
            </li>
            <li>
              <strong>GitHub</strong> — only if you explicitly connect your account, to create
              repositories on your behalf.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">How long we keep data</h2>
          <p>
            [Define a real retention policy here — e.g. &ldquo;project data is retained until you
            delete the project or your account; deleted accounts are purged within N days.&rdquo;]
            This isn&apos;t yet automated in the codebase — account/project deletion flows are on the
            roadmap.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, export, or delete
            your personal data. [Add your jurisdiction-specific rights language and a contact method
            for exercising them here.]
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">Security</h2>
          <p>
            See SECURITY.md in the source repository for the technical measures in place, including
            encryption of stored third-party tokens and database access controls.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">Contact</h2>
          <p>Questions about this policy: [support/privacy email].</p>
        </section>
      </div>
    </div>
  );
}
