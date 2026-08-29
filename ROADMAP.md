# Roadmap

> **Note:** this project originally shipped on Supabase (Postgres + Supabase
> Auth) and was migrated to Firebase (Firestore + Firebase Auth). The P0/P1/P2
> status below reflects the current Firebase-based implementation.

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

## Smaller follow-ups worth doing next

- A real line-level diff view for pending changes (today it's a file-level
  create/update/delete list, which is enough to make an informed
  Accept/Reject decision but doesn't show exactly what changed inside a file).
- Project/file size limits.
- Analytics events listed in the spec (`signup`, `project_created`,
  `generation_started`, etc.) — the event *names* and where they'd fire are
  clear from the code, but no analytics provider is wired in yet.
- The rate limiter is a blunt fixed-window counter; a sliding-window or
  token-bucket implementation would be smoother if usage patterns show it
  matters.
- GitHub export and Stripe billing should be exercised against real (test
  mode / sandbox) accounts before shipping to real users — see the caveats
  under each in ARCHITECTURE.md and SECURITY.md.
- Stripe plan changes mid-subscription (upgrading Pro → Pro+) aren't handled
  by a dedicated flow yet — the person would need to cancel and resubscribe,
  or this could route through the Billing Portal's own plan-switching UI if
  enabled on the Stripe side.
