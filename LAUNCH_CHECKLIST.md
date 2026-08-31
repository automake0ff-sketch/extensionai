# Launch checklist

A frank assessment of what's actually done vs. what still needs a human to
do something outside this codebase before ExtenAI can take real users and
real money. Organized so you can tell at a glance what's blocking launch.

## ✅ Code-complete (verified: typecheck, lint, 25 unit tests, production
build, and a local smoke test all pass as of this commit)

**Core product (spec section 28's MVP success criteria) — the whole golden
path works end to end:** sign up → create project → describe an extension →
AI generates it → view/edit files → chat a change → Accept/Reject with a
line diff → validator → download a ZIP with a real Manifest V3 → loadable
via `chrome://extensions` → Developer mode → Load unpacked.

Beyond that golden path:
- Version history with restore, for both AI and manual edits
- GitHub export (OAuth connect, single-commit push to a new repo)
- Stripe billing (Checkout, Billing Portal, webhook-driven plan sync)
- Rate limiting on the AI endpoints; project/file size limits enforced
  server-side, with a live indicator in the editor
- Security headers (CSP, X-Frame-Options, etc.), Firestore rules that deny
  all direct client access, encrypted-at-rest GitHub tokens, friendly
  error/404 pages
- Analytics event instrumentation (all of spec section 24's event names)
- Terms of Service / Privacy Policy pages — **drafts**, see below

None of this is simulated — every route in ARCHITECTURE.md does what it
says. What's *not* done is exercising it against live third-party accounts,
because this environment has no real Firebase/GitHub/Stripe credentials to
test with.

## 🔲 Requires you to do something outside this repo

These aren't code gaps — they're steps only you can take (they need
accounts, legal judgment, or money), and none of them are things I can
complete for you from here.

1. **Create a real Firebase project** and fill in every variable in
   `.env.example` — see SETUP.md steps 1–6. Deploy `firestore.rules` and
   `firestore.indexes.json`, or `listProjects`/version-history queries will
   fail with a Firestore "missing index" error the first time someone hits
   them.
2. **Register a GitHub OAuth App** and a **Stripe account** (test mode
   first) if you want those features live — SETUP.md steps 7–8. Both
   features degrade gracefully if left unconfigured (a clear "not
   configured" message instead of a crash), so you can launch without
   either and turn them on later.
3. **Have a lawyer review `/terms` and `/privacy`.** Both pages are real,
   working routes with content that accurately describes what this codebase
   actually stores and which third parties it shares data with — but the
   bracketed placeholders (`[DATE]`, `[Company legal name]`, liability caps,
   your actual retention policy, etc.) are not filled in, and the whole
   thing needs a lawyer's sign-off for your jurisdiction before you rely on
   it. Chrome Web Store and Stripe both effectively require a real privacy
   policy for anything you publish through them.
4. **Test GitHub export and Stripe billing against real (sandbox) accounts.**
   Both integrations are code-complete (see ARCHITECTURE.md) but have never
   been exercised against a live GitHub OAuth App or a live Stripe account
   from this environment — there's a real difference between "the code is
   correct by inspection" and "someone clicked through it against the real
   API." Budget an hour for this before turning either on for paying users.
5. **Decide on a domain and deploy** (e.g. to Vercel — this is a standard
   Next.js app, no special hosting requirements). Point
   `GITHUB_OAUTH_CLIENT_ID`'s callback URL and Stripe's webhook endpoint at
   the real production URL, not `localhost`.
6. **Set up basic monitoring.** There's no error-tracking service wired in
   (the `error.tsx`/`global-error.tsx` pages have a `console.error` call
   marked as the hook point — see the comment in `error.tsx`). At minimum,
   watch your hosting provider's logs for the first few days.
7. **Decide your actual Stripe prices** and create them in the Stripe
   dashboard — `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PRO_PLUS` need real price
   IDs, and the $19/$49 numbers on the landing page and pricing section are
   the spec's suggested defaults, not something this build enforces from a
   single source of truth. If you change the price, update both the Stripe
   dashboard and `src/app/page.tsx`'s pricing section together.
8. **Decide what to do about account/project deletion.** Right now there's
   no user-facing "delete my account" or "delete this project" flow — worth
   having before you're handling real people's data, both for UX and for
   privacy-law compliance (the Privacy Policy draft already flags this).

## Deliberately not built (by the original product spec, not an oversight)

- Automated Chrome Web Store publishing — `/api/store-prep` prepares
  everything (ZIP, permission explanations, checklist); actual submission
  stays manual, per spec section 18.
- Team collaboration, multi-user projects.
- A public marketplace/gallery of extensions.

These were explicitly deprioritized in the original spec (section 25: "NO
implementar P2 antes de tener P0 funcionando") and aren't required for a v1
launch — the product is fully usable by an individual builder without them.

## Bottom line

**The code is ready.** Every feature in the spec's P0 and P1, plus GitHub
export and Stripe billing from P2, works and is verified (build/lint/test
all green). What stands between this and a real launch is entirely the
external setup in the checklist above — a Firebase project, OAuth app
credentials, a Stripe account, a domain, and a lawyer's pass on the legal
pages — none of which can be done from inside this development environment.
None of it is a lot of work, and most of it (steps 1–2) is normal "hook up
your third-party services" work you'd do for any new app on this stack.
