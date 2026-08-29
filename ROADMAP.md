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
- [x] Accept/Reject flow for AI changes — `POST /api/modify` now proposes a
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
- [ ] **Still not implemented:** GitHub export. Architecture is prepared
      (`GITHUB_OAUTH_CLIENT_ID/SECRET` in `.env.example`, a disabled "Connect
      GitHub" affordance in Settings) but the OAuth flow and repo/commit
      creation don't exist yet. Per spec section 17, ZIP export was
      prioritized instead — this is next in line for P1.

## P2 — not started (by design, per spec section 25)

- [ ] Stripe billing. `usage`/credits accounting exists and plans are
      defined (`lib/usage/index.ts`), but no payment can currently be taken.
      Upgrading a plan in Settings does not charge a card.
- [ ] Automated Chrome Web Store publishing. `/api/store-prep` builds the
      ZIP, permission explanations, privacy notes, and a checklist — the
      person still submits manually via their own developer account.
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

## Smaller follow-ups worth doing next

- GitHub export (OAuth connect + create repo/commit).
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
