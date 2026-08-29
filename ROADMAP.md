# Roadmap

> **Note:** this project originally shipped on Supabase (Postgres + Supabase
> Auth) and was migrated to Firebase (Firestore + Firebase Auth). The P0/P1/P2
> status below reflects the current Firebase-based implementation; nothing
> about the migration changed which features are done vs. planned.

Status of the priority order from the product spec (section 25).

## P0 — done, working end to end

- [x] Auth (Firebase Authentication: email/password + optional GitHub/Google
      sign-in via popup, backed by a server-verified session cookie)
- [x] Dashboard (recent projects, credit usage, plan)
- [x] Create project (`/projects/new`, prompt + templates)
- [x] Prompt → extension (`generateExtension`: Architect → Coder → Zod validation)
- [x] Save files (Firestore `files` subcollection, replaced on generation)
- [x] Editor (file tree + code editor, manual save)
- [x] Chat → modify extension (`modifyExtension`: Modifier prompt → targeted diff)
- [x] Validator (manifest, referenced files, security patterns)
- [x] ZIP export (`/api/export`, loads unpacked via chrome://extensions)

## P1 — partially done

- [x] Preview — implemented as a static, sandboxed popup renderer + parsed
      manifest summary (spec section 13 explicitly allows this fallback when
      a full extension runtime isn't available; it's honestly labeled as
      such in the UI).
- [x] Version history — every AI-driven overwrite snapshots the prior file
      into the `versions` subcollection before applying the change.
  - [ ] **Not yet built:** a UI to browse and restore a specific past
        version. The data is captured; the restore action isn't exposed yet.
  - [ ] **Not yet built:** an Accept/Reject flow for individual AI changes —
        today an AI edit applies immediately (with the version safety net
        above), rather than showing a pending diff first.
- [x] GitHub — architecture is prepared (`GITHUB_OAUTH_CLIENT_ID/SECRET` in
      `.env.example`, a disabled "Connect GitHub" affordance in Settings)
      but the OAuth flow and repo/commit creation are **not implemented**.
      Per spec section 17, ZIP export was prioritized instead.
- [x] Test generation — `generateTests` (Tester prompt) produces a static
      test plan with `planned` vs. `manual_verification_required` cases. No
      test is ever reported as executed.

## P2 — not started (by design, per spec section 25)

- [ ] Stripe billing. `usage`/credits accounting exists and plans are
      defined (`lib/usage/index.ts`), but no payment can currently be taken.
      Upgrading a plan in Settings does not charge a card.
- [ ] Automated Chrome Web Store publishing. `/api/store-prep` builds the
      ZIP, permission explanations, privacy notes, and a checklist — the
      person still submits manually via their own developer account.
- [ ] Team collaboration.
- [ ] Marketplace.

## Smaller follow-ups worth doing next

- Gate ZIP export on `validateProject().valid` (currently informational
  only — see SECURITY.md).
- Rate limiting on `/api/generate` and `/api/modify`.
- A real diff view (side-by-side or inline) before an AI change is applied,
  not just a post-hoc version snapshot.
- Project/file size limits.
- Analytics events listed in the spec (`signup`, `project_created`,
  `generation_started`, etc.) — the event *names* and where they'd fire are
  clear from the code, but no analytics provider is wired in yet.
