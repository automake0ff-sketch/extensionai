# Launch checklist

A frank assessment of what's actually done vs. what still needs a human to
do something outside this codebase before ExtenAI can take real users and
real money. Organized so you can tell at a glance what's blocking launch.

> **Update — live deployment reached, one production bug found and fixed
> (commit `d76a68d`).** Real Firebase + Anthropic + OpenRouter credentials
> were wired in and validated as far as this development environment's
> network restrictions allow (it can reach `api.anthropic.com` but not
> Firebase's or OpenRouter's domains — see "What's actually been verified"
> below for exactly what that means). The first real Vercel deploy 500'd on
> every page, including the public landing page; root cause was `proxy.ts`
> accidentally bundling the full Firebase Admin SDK into a runtime that
> can't load one of its dependencies. Fixed, verified by inspecting the
> built output directly, and pushed. See ROADMAP.md for the full writeup.

> **Update — a second, related bug found and fixed, still needs live
> confirmation.** After the first fix (`proxy.ts` bundling issue), a real
> signup attempt on Vercel hit the *same* `ERR_REQUIRE_ESM` error family,
> this time from `/api/auth/session`. Root cause: `firebase-admin` itself
> does a top-level `require("jwks-rsa")` that Next's bundler mishandles in
> Vercel's serverless packaging — unrelated to the proxy this time. Fixed
> with `serverExternalPackages` in `next.config.ts` (the standard, documented
> fix for this exact error signature), but **this one could not be
> reproduced locally to prove the fix works** — see ROADMAP.md for the full
> honest writeup. Redeploy and retest signup before trusting this is closed.

## What's actually been verified, and how

This section exists because "verified" can mean different things — being
precise about which is true for which piece:

| Component | Verified how | Confidence |
|---|---|---|
| Code correctness (typecheck/lint/tests/build) | Run directly, repeatedly, in this environment | High — this is unambiguous |
| Firebase Admin credentials (service account) | SDK accepted the credential; a real call reached toward `firestore.googleapis.com` before being blocked by *this dev environment's* network policy, not by anything wrong with the credential | High that the credential is valid; **no live Firestore read/write has actually succeeded yet** |
| Firebase client config | Builds correctly into the app; never exercised in a real browser (this environment has no browser, only curl) | Structural only |
| Anthropic API key + model | A real API call reached Anthropic's server and got a real, specific error (org-key scoping, then insufficient credit) — not a network or code error | High — the request pipeline works, the account just needs credit |
| OpenRouter API key + model | **Never reached OpenRouter's servers at all** — `openrouter.ai` is blocked from this dev environment the same way Firebase is. Key validity and the chosen free model's availability are both unconfirmed | Structural only |
| The `proxy.ts` production fix | Rebuilt and inspected the actual compiled output for the two specific chunks the proxy loads — zero references to the library that caused the crash | High |
| The full signup → generate → download golden path, live | **Not yet confirmed by anyone, from anywhere** | This is the one that matters most and is still open |

The practical upshot: the outage you hit and reported is fixed and verified.
Whether generation itself works today, on OpenRouter's free tier, against
your real Vercel deployment, is the one remaining open question — and it
can only be answered by actually trying it, from somewhere with normal
internet access (i.e., not from me, from this environment).

## ✅ Code-complete (typecheck, lint, 28 unit tests, production build all
green as of this commit)

**Core product (spec section 28's MVP success criteria) — the whole golden
path exists in code:** sign up → create project → describe an extension →
AI generates it → view/edit files → chat a change → Accept/Reject with a
line diff → validator → download a ZIP with a real Manifest V3 → loadable
via `chrome://extensions` → Developer mode → Load unpacked.

Beyond that: version history with restore, GitHub export, Stripe billing,
an on-demand AI review alongside the free static validator, rate limiting,
project size limits with a live UI indicator, security headers, Firestore
rules that deny all direct client access, encrypted-at-rest GitHub tokens,
friendly error/404 pages, analytics event instrumentation, and Terms/Privacy
drafts. Two AI providers are supported (Anthropic, OpenRouter) behind one
interface, switchable via `AI_PROVIDER` with no code changes.

## 🔲 The one thing to do right now

**Actually run the golden path against your live Vercel deployment and see
what happens.** Concretely:

1. Open your Vercel URL. Confirm `/` loads (should be fixed now).
2. Sign up with a real email/password.
3. Create a project, describe a simple extension, hit Generate.
4. Watch what happens. Three outcomes are all informative:
   - **It works** — you have a working MVP, go to the next section.
   - **It fails with a specific error message** (e.g. "we couldn't generate
     your extension") — check Vercel's Runtime Logs the same way you did
     for the last bug, and send me the log. Likely causes, in order of
     probability: the chosen free OpenRouter model got deprecated/renamed
     (check https://openrouter.ai/models?max_price=0 and update `AI_MODEL`
     in Vercel's env vars), or a Firestore composite index isn't deployed
     yet (see item 1 below — the error message from Firestore includes a
     direct link to create the missing index).
   - **Signup itself fails** — almost certainly a Firestore index or a
     copy-paste error in the Firebase env vars; again, check Runtime Logs.

## 🔲 Requires you to do something outside this repo

0. **Set `BETA_ALLOWED_EMAILS` in Vercel to your own email(s), then
   redeploy.** The product now gates new sign-ups behind a closed-beta
   waitlist by default (`WAITLIST_GATE_ENABLED`) — see ARCHITECTURE.md's
   "Closed beta gate" section. Without this set, **you will lock yourself
   out of your own product** the next time you try to create a test
   account with a new email. Comma-separate multiple addresses if needed.

1. **Deploy `firestore.rules` and `firestore.indexes.json`** if you haven't
   — via `firebase deploy --only firestore:rules,firestore:indexes`, or by
   pasting them into the Firebase console manually (SETUP.md step 6).
   Without the indexes specifically, `listProjects` (your dashboard) and
   file-version history will fail — Firestore's error message includes a
   direct link to create the missing index, so this is self-diagnosing if
   you hit it.
2. **Confirm the OpenRouter free model still exists.** Their free catalog
   rotates. If generation fails, this is the first thing to check.
3. **Register a GitHub OAuth App and/or a Stripe account** (test mode
   first) if/when you want those features live. Both degrade gracefully if
   left unconfigured.
4. **Have a lawyer review `/terms` and `/privacy`** before you rely on them
   — they're accurate drafts, not reviewed legal documents. Needed before
   Chrome Web Store or Stripe will really be comfortable, and before you
   take on real user data at any scale that matters to you.
5. **Point real domains/callback URLs at production**, not `localhost` —
   GitHub OAuth callback, Stripe webhook endpoint, once you set those up.
6. **Set up basic monitoring/error tracking.** Watch Vercel's Runtime Logs
   for the first while; `error.tsx`/`global-error.tsx` have a marked hook
   point for wiring in a real error tracker later.
7. **Decide on account/project deletion.** No user-facing flow for this
   yet — worth having before real users' data is involved.

## Deliberately not built (by the original product spec, not an oversight)

Automated Chrome Web Store publishing, team collaboration, and a public
marketplace — all explicitly P2/deprioritized in the original spec and not
required for a v1 launch.

## Bottom line

**The code is ready and one real production bug is now fixed and verified.**
The single open question — does generation actually work end-to-end on the
live deployment — can't be answered from this environment; it needs someone
with normal internet access to click through it once. Do that next, before
inviting anyone else in.
