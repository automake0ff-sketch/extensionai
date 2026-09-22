import Link from "next/link";
import { ExtenAIMark } from "@/components/brand/mark";
import { WaitlistForm } from "@/components/app/waitlist-form";
import { ArrowRight, Check, Puzzle, ShieldCheck, GitBranch, FlaskConical, Download } from "lucide-react";

const EXAMPLE_PROMPTS = [
  "Create an extension that audits a page's title, meta description, and heading structure.",
  "Create a browser tool that extracts every table on a page and exports it to CSV.",
  "Create an extension that finds broken links on the current page.",
  "Create a Gmail assistant that summarizes long threads.",
];

const TEMPLATES = [
  { name: "SEO tools", desc: "On-page audits, meta tag inspection, broken link checks." },
  { name: "Data export", desc: "Pull tables or lists from any page and export them to CSV." },
  { name: "Gmail productivity", desc: "Summarize threads, snooze emails, add quick templates." },
  { name: "Internal ops tools", desc: "Small team-specific helpers — form fillers, checklists, status trackers." },
  { name: "Screenshot tools", desc: "Full-page capture, annotate, and export instantly." },
  { name: "Personal productivity", desc: "Focus timers, tab management, reading-list helpers." },
];

const STEPS = [
  { title: "Describe it", desc: "Tell ExtenAI what the extension should do, in plain English." },
  { title: "It gets built", desc: "An Architect plans permissions and files; a Coder writes a working Manifest V3 extension." },
  { title: "Try it", desc: "Inspect the popup, structure, and manifest in a live preview." },
  { title: "Refine by chat", desc: "\"Add dark mode\" or \"only run on amazon.com\" — changes apply as a diff, not a rewrite." },
  { title: "Validate & ship", desc: "A built-in checker flags risky permissions and broken references before you export." },
  { title: "Download & load it", desc: "Get a ZIP that loads unpacked in chrome://extensions, ready for the Chrome Web Store." },
];

const FEATURES = [
  { icon: Puzzle, title: "Manifest V3 by default", desc: "Every extension is generated against the current Chrome extension platform, with the minimum permissions the task needs." },
  { icon: ShieldCheck, title: "Built-in validator", desc: "Checks manifest correctness, broken file references, and dangerous patterns like eval() or hardcoded secrets before export." },
  { icon: GitBranch, title: "Version history", desc: "Every AI edit snapshots the previous file first, so you can always step back." },
  { icon: FlaskConical, title: "Test planning", desc: "Get a structured checklist of what to verify by hand and what's structurally sound — never a false claim that tests ran." },
];

const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. Describe the extension in plain language. You can read and edit the generated code if you want to, but it isn't required.",
  },
  {
    q: "Does this publish to the Chrome Web Store for me?",
    a: "Not automatically. ExtenAI prepares everything you need — the ZIP, a permissions explanation, and a publishing checklist — and you submit it yourself through your own developer account.",
  },
  {
    q: "What if the AI's changes break something?",
    a: "Every file is versioned before it's overwritten, so you can restore a previous version at any time.",
  },
  {
    q: "Can I see the actual code?",
    a: "Yes — the editor shows every file ExtenAI generates, and you can read the manifest and source directly.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-ink-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <ExtenAIMark className="h-6 w-6 text-accent" />
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              ExtenAI
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-ink-dim sm:flex">
            <a href="#how-it-works" className="hover:text-ink-100">How it works</a>
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#pricing" className="hover:text-ink-100">Pricing</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-ink-dim hover:text-ink-100">
              Log in
            </Link>
            <a
              href="#waitlist"
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 text-xs text-ink-dim">
          <ExtenAIMark className="h-3.5 w-3.5" /> Manifest V3 · Chrome extensions
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight sm:text-6xl">
          Build browser extensions with AI.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-dim">
          Describe what you want. Get a working browser extension. Edit it by chatting with AI.
        </p>

        {/* Signature element: the "omnibox" prompt bar */}
        <div id="waitlist" className="mx-auto mt-10 max-w-2xl scroll-mt-24">
          <div className="omnibox flex items-center gap-3 px-5 py-4 text-left">
            <span className="h-2 w-2 shrink-0 rounded-full bg-good" />
            <span className="truncate text-sm text-ink-dim sm:text-base">
              Create a Chrome extension that audits a page&apos;s SEO tags and flags what&apos;s missing.
            </span>
          </div>
          <p className="mt-6 text-sm font-medium text-ink-100">ExtenAI is in closed beta.</p>
          <WaitlistForm className="mt-3" />
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <div key={prompt} className="rounded-2xl border border-ink-line bg-ink-raised px-4 py-3 text-sm text-ink-dim">
              &ldquo;{prompt}&rdquo;
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-ink-line bg-ink-raised/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            From idea to loaded extension
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-ink-line bg-ink p-5">
                <span className="font-[family-name:var(--font-mono)] text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-dim">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Built for real extensions, not demos
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-ink-line bg-ink-raised p-5">
                <f.icon className="h-6 w-6 shrink-0 text-accent" />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-dim">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates / examples */}
      <section className="border-t border-ink-line bg-ink-raised/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Start from a template
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <div key={t.name} className="rounded-2xl border border-ink-line bg-ink p-5">
                <h3 className="font-medium">{t.name}</h3>
                <p className="mt-1 text-sm text-ink-dim">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Pricing
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-dim">
            Preliminary — during the closed beta, everyone starts on Free. We&apos;ll confirm paid
            pricing once we&apos;ve validated it with early users.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              { name: "Free", price: "$0", items: ["2 projects", "20 AI credits / month", "ZIP export"] },
              { name: "Pro", price: "$19", items: ["Unlimited projects", "300 AI credits / month", "Version history", "Advanced validation", "GitHub export"], highlight: true },
              { name: "Pro+", price: "$49", items: ["1000 AI credits / month", "Automated test planning", "Advanced AI", "Publishing tools"] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${plan.highlight ? "border-accent bg-accent-dim/40" : "border-ink-line bg-ink-raised"}`}
              >
                <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-3xl font-semibold">
                  {plan.price}
                  <span className="text-base font-normal text-ink-dim">/month</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-ink-dim">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-good" /> {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  className={`mt-6 block rounded-full py-2.5 text-center text-sm font-medium ${
                    plan.highlight ? "bg-accent text-white hover:opacity-90" : "border border-ink-line hover:bg-ink"
                  }`}
                >
                  Join the waitlist
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-line bg-ink-raised/40 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-ink-line">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium marker:content-none">
                  {faq.q}
                </summary>
                <p className="mt-2 text-sm text-ink-dim">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <Download className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Tell it what you want. It builds it.
          </h2>
          <a
            href="#waitlist"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Join the waitlist <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-ink-line py-8 text-center text-xs text-ink-dim">
        <p>ExtenAI — generated extensions load via chrome://extensions in Developer mode.</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <Link href="/terms" className="hover:text-ink-100">Terms</Link>
          <Link href="/privacy" className="hover:text-ink-100">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
