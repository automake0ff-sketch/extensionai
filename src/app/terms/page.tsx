import Link from "next/link";
import { ExtenAIMark } from "@/components/brand/mark";

export const metadata = { title: "Terms of Service — ExtenAI" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <ExtenAIMark className="h-5 w-5 text-accent" />
        <span className="font-[family-name:var(--font-display)] font-semibold">ExtenAI</span>
      </Link>

      <div className="mb-8 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <strong>Draft template — not legal advice.</strong> This page is placeholder text generated
        for development purposes. Have a lawyer review and adapt it (governing law, arbitration/venue,
        liability caps, refund policy, DMCA process, etc.) before this product accepts real users or
        real payments.
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-sm text-ink-dim">Last updated: [DATE — fill in at launch]</p>

      <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed text-ink-dim">
        <section>
          <h2 className="text-base font-medium text-ink-100">1. Who we are</h2>
          <p>
            ExtenAI (&ldquo;we,&rdquo; &ldquo;us&rdquo;) provides a service that generates, edits, and
            packages browser extension code based on natural-language descriptions you provide. [Company
            legal name, registered address, and contact email go here.]
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">2. Your account</h2>
          <p>
            You&apos;re responsible for the activity that happens under your account, and for keeping
            your credentials secure. You must be old enough to form a binding contract in your
            jurisdiction to use ExtenAI.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">3. What you can do with generated code</h2>
          <p>
            Subject to payment of any applicable fees, you own the code ExtenAI generates for your
            projects and may use, modify, and distribute it — including publishing it to the Chrome
            Web Store or elsewhere — as you see fit. You&apos;re solely responsible for reviewing
            generated code for correctness, security, and compliance with any platform you publish to
            (e.g. Chrome Web Store policies) before distributing it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">4. Acceptable use</h2>
          <p>
            You agree not to use ExtenAI to generate extensions intended to violate others&apos;
            privacy, deceive users, circumvent platform security, scrape data in violation of a
            site&apos;s terms, or otherwise break the law. We may suspend accounts that violate this.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">5. AI-generated content disclaimer</h2>
          <p>
            Generated code is produced by an AI model and may contain errors, security issues, or
            unnecessary permissions despite our validator&apos;s checks. ExtenAI is provided
            &ldquo;as is&rdquo; without warranty that generated extensions are fit for any particular
            purpose. Always review the validator&apos;s findings and test an extension yourself before
            publishing or relying on it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">6. Billing</h2>
          <p>
            Paid plans are billed in advance on a recurring basis via Stripe. [Refund policy,
            proration rules, and cancellation terms go here.] You can cancel anytime from Settings; a
            cancellation takes effect at the end of the current billing period unless stated otherwise.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">7. Limitation of liability</h2>
          <p>[Standard liability cap and disclaimer language — have counsel draft this section.]</p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">8. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Material changes will be announced with
            reasonable notice.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-ink-100">9. Contact</h2>
          <p>Questions about these terms: [support email].</p>
        </section>
      </div>
    </div>
  );
}
