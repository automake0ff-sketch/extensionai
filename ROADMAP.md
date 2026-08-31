# Roadmap

> **Note:** this project originally shipped on Supabase (Postgres + Supabase
> Auth) and was migrated to Firebase (Firestore + Firebase Auth). The P0/P1/P2
> status below reflects the current Firebase-based implementation.
>
> **Looking for launch readiness, not feature status?** See
> [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) — it separates what's
> code-complete from what needs real external accounts and legal review.

Status of the priority order from the product spec (section 25).

## P0 — done, working end to end

- [x] Auth (Firebase Authentication: email/password + optional GitHub/Google
      sign-in via popup, backed by a server-verified session cookie)
- [x] Dashboard (recent projects, credit usage, plan)
- [x] Create project (`/projects/new`, prompt + templates)
- [x] Prompt → extension (`generateExtension`: Architect → Coder → Zod validation)
- [x] Save files (Firestore `files` subcollection, replaced on generation)
- [x] Editor (file tree + code editor, manual save)
- [x] Chat → modify extension (`modifyExtension`: Modifier prompt → proposed diff)
- [x] Validator (manifest, referenced files, security patterns)
- [x] ZIP export (`/api/export`, loads unpacked via chrome://extensions)

## P1 — done

- [x] Preview — static, sandboxed popup renderer + parsed manifest summary
      (spec section 13 explicitly allows this fallback when a full extension
      runtime isn't available; it's honestly labeled as such in the UI).
- [x] Version history — every AI-driven or manual overwrite snapshots the
      prior file into the `versions` subcollection, and the editor exposes a
      **History** panel per file (`GET /api/files/versions`) with a
      **Restore** action (`POST /api/files/restore`) that itself snapshots
      the current content first, so restoring is undoable too.
- [x] Accept/Reject flow for AI changes — `POST /api/modify` proposes a
      change without touching any file. The chat shows the proposed diff
      (file list + action icons) with **Accept**/**Reject** buttons;
      accepting calls `POST /api/modify/apply` (applies with the same
      version-snapshot safety net), rejecting calls
      `POST /api/modify/discard` (files untouched). The AI credit is spent
      when the proposal is generated, not on accept, since that's when the
      model call actually happened.
- [x] Test generation — `generateTests` (Tester prompt) produces a static
      test plan with `planned` vs. `manual_verification_required` cases. No
      test is ever reported as executed.
- [x] GitHub export — connect via OAuth (`/api/github/connect` →
      `/api/github/callback`, token encrypted at rest), then export any
      project to a brand-new repository as a single atomic commit
      (`/api/github/export`, using the Git Data API rather than one REST
      call per file). Untested against a live GitHub account from this
      environment — validate end-to-end against your own OAuth App before
      depending on it in production.

## P2

- [x] Stripe billing — `POST /api/billing/checkout` (Checkout Session),
      `POST /api/billing/portal` (Billing Portal for self-service
      cancel/update card), and `POST /api/billing/webhook` (reconciles
      `profiles.plan` from `checkout.session.completed` /
      `customer.subscription.updated` / `.deleted`) are all implemented.
      Also untested against a live Stripe account from this environment —
      validate in Stripe test mode first.
- [ ] Automated Chrome Web Store publishing. `/api/store-prep` builds the
      ZIP, permission explanations, privacy notes, and a checklist — the
      person still submits manually via their own developer account. Per
      spec section 18, this is intentionally the last thing to automate.
- [ ] Team collaboration.
- [ ] Marketplace.

## Recently closed follow-ups

- [x] **ZIP export now blocks on validation errors.** `GET /api/export`
      runs `validateProject()` first; if there are errors it returns 409
      with `{ requiresConfirmation: true, validation }` instead of the file,
      and the UI shows the specific errors with an explicit "Export anyway"
      override. Warnings alone don't block anything.
- [x] **Basic rate limiting** on `/api/generate` (5/min per user) and
      `/api/modify` (10/min per user), via a Firestore-backed fixed-window
      counter (`lib/firebase/ratelimit.ts`) that works correctly across
      serverless instances.
- [x] **GitHub export** and **Stripe billing** — see P1/P2 above.
- [x] **Project/file size limits** (`lib/limits.ts`): 60 files/project,
      300 KB/file, 3 MB/project total. Enforced after generation
      (`/api/generate`), before a proposed change can be accepted
      (`/api/modify` at proposal time, and again defensively in
      `/api/modify/apply`), and on manual editor saves (`/api/files`).
      Violations return a specific, human-readable 400 rather than a vague
      failure.
- [x] **Analytics events wired up** (`lib/analytics/index.ts`), using
      exactly the event names from spec section 24: `signup`,
      `project_created`, `generation_started`/`completed`/`failed`,
      `preview_opened`, `download_clicked`, `github_connected`,
      `upgrade_clicked`. No provider (PostHog/Segment/etc.) is connected yet
      — events are written to an `analytics_events` Firestore collection, so
      the instrumentation is real and queryable today, and swapping in a
      real provider later is a one-file change (`track()`'s implementation),
      not a re-instrumentation of every call site. Per spec section 24,
      properties are deliberately minimal (IDs, counts, plan names) — never
      prompt text or file contents.
- [x] **Line-level diff view for pending changes.** The Accept/Reject card
      now lets you expand any changed file to see an actual added/removed
      line diff (`components/editor/file-diff-view.tsx`, using the `diff`
      package), not just the file-level create/update/delete list from
      before. Large diffs are capped at 300 rendered lines to keep the UI
      responsive.
- [x] **Project size limits surfaced in the UI**, not just enforced
      server-side — a live `N/60 files · N KB` indicator in the workspace
      top bar (`components/editor/project-size-indicator.tsx`), turning
      amber past 80% of either limit.
- [x] **App-wide security headers** (CSP, X-Frame-Options, etc.) added in
      `next.config.ts` — closes the gap previously tracked in SECURITY.md.
- [x] **Friendly error/404 pages** (`app/not-found.tsx`, `app/error.tsx`,
      `app/global-error.tsx`) — spec section 23's "no raw stack traces"
      principle now applies to page-level errors, not just API responses.
- [x] **Terms of Service and Privacy Policy pages** (`/terms`, `/privacy`) —
      real, working routes with content accurate to what this codebase
      actually stores, clearly marked as drafts needing a lawyer's review
      before launch (see LAUNCH_CHECKLIST.md).

## Smaller follow-ups worth doing next

- GitHub export and Stripe billing should be exercised against real (test
  mode / sandbox) accounts before shipping to real users — see
  LAUNCH_CHECKLIST.md.
- Stripe plan changes mid-subscription (upgrading Pro → Pro+) aren't handled
  by a dedicated flow yet — the person would need to cancel and resubscribe,
  or this could route through the Billing Portal's own plan-switching UI if
  enabled on the Stripe side.
- The rate limiter is a blunt fixed-window counter; a sliding-window or
  token-bucket implementation would be smoother if usage patterns show it
  matters.
- No real analytics provider is connected — events are captured in Firestore
  but nothing visualizes them yet.
- No account/project deletion flow — see LAUNCH_CHECKLIST.md.
- No error-tracking service wired in — `error.tsx`/`global-error.tsx` have a
  marked hook point for adding one.
