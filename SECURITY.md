# Security model

## Principles this codebase follows (spec section 22)

- **No server-side execution of generated code.** Nothing the AI writes is
  ever `eval`'d, imported, or run on the ExtenAI server. The "preview" is a
  sandboxed `<iframe sandbox="allow-scripts">` rendering the extension's own
  popup HTML in the *user's browser* — the ExtenAI backend never executes it.
- **Environment variables, not hardcoded secrets.** See ENVIRONMENT.md. The
  validator additionally scans every generated file for hardcoded
  credential-like strings (`lib/validator/manifest.ts`).
- **No direct client access to the database.** `firestore.rules` denies
  every read and write (`allow read, write: if false`). The browser never
  imports `firebase/firestore` — it only uses `firebase/auth` to sign in,
  then calls ExtenAI's own Next.js API routes for everything else. Those
  routes use the Firebase **Admin SDK**, which bypasses the rules above by
  design, so the actual access control lives in application code:
  - `getSession()` / `requireSession()` (`lib/firebase/session.ts`) verifies
    the caller's identity via a signed session cookie on every request.
  - Every Firestore helper that reads or writes project data
    (`lib/firebase/firestore.ts`) takes the `uid` as a parameter and checks
    it against the project's `userId` field before returning or mutating
    anything — e.g. `getOwnedProject(uid, projectId)` returns `null` (not an
    error, not someone else's data) if the project belongs to another user.
  - This is the Firestore equivalent of what Postgres Row Level Security did
    automatically in the previous Supabase-based version of this app; moving
    it into application code was a deliberate tradeoff (see "Why not
    Firestore rules for this?" below).
- **Structured AI output only.** The AI never returns arbitrary HTML/text
  that gets stored or rendered as-is. Every AI call is parsed through a Zod
  schema (`lib/ai/schemas.ts`); a malformed response is rejected and surfaced
  as a friendly error rather than persisted.
- **Static security scanning before export** (`lib/validator/manifest.ts`):
  flags `eval()`, `new Function()`, `document.write()`, remote `<script src>`
  tags (which Manifest V3 disallows for extension pages), and hardcoded
  secret-shaped strings. This runs both on demand (the "Health" panel) and is
  intended to gate export in a future iteration (see ROADMAP.md — today it
  runs but does not yet hard-block the download).
- **Least-privilege permissions.** The Architect prompt is explicitly
  instructed to request only permissions the plan needs and prefer
  `activeTab` over broad host permissions; the validator separately flags
  sensitive permissions (`tabs`, `webRequest`, `<all_urls>`, etc.) for human
  review.
- **CSP / no remote code.** Manifest V3 itself disallows remote code
  execution for extension pages; the Coder prompt and validator both
  reinforce this rather than relying on the platform alone.
- **Friendly error handling.** API routes never return raw exception text to
  the client (see `lib/errors.ts`); technical details are namespaced under
  `technicalDetails` for an optional "show details" affordance, not shown by
  default.
- **Session cookie, not a bare ID token, for server auth.** The client
  exchanges a short-lived Firebase ID token for an httpOnly session cookie
  once, right after sign-in (`POST /api/auth/session`), instead of sending
  the ID token on every request. The cookie is `httpOnly` + `secure` (in
  production) + `sameSite: lax`, so it isn't readable from JavaScript and
  isn't sent on cross-site requests.

## Why not Firestore rules for this?

Firestore Security Rules are a natural fit for data shaped as flat, directly
client-accessible collections. This app's data isn't shaped that way — most
ownership checks need to walk from a subcollection document (a file, a chat
message) up to its parent `projects/{id}` document to check `userId`, which
rules *can* do (`get()` calls inside a rule) but at real latency and
complexity cost per read. Given every read here already goes through a
Route Handler for other reasons (calling the AI, running the validator,
building a ZIP), centralizing authorization in that same server code — with
Firestore locked down to deny direct access entirely — was simpler to audit
than splitting the logic between rules and route handlers.

## Known gaps in this MVP (tracked in ROADMAP.md)

- There is no per-IP rate limiting, only per-authenticated-user (via
  `lib/firebase/ratelimit.ts`, a Firestore-backed fixed-window counter on
  `/api/generate` and `/api/modify`). An unauthenticated flood is already
  blocked by `getSession()` returning 401 first, but a determined attacker
  with many free accounts isn't meaningfully slowed down yet.
- File size / project size limits are not yet enforced server-side.
- CSP headers for the ExtenAI app itself (not the generated extensions) are
  not yet configured in `next.config.ts`.
- The Firestore composite indexes in `firestore.indexes.json` need to be
  deployed (or created manually) before `listProjects` and file-version
  history queries will work — see SETUP.md step 6. Until then those specific
  queries will fail loudly (Firestore returns a direct link to create the
  missing index in the error), not silently return wrong data.
- GitHub export isn't implemented (see ROADMAP.md).

## Reporting a vulnerability

This is a sample/reference implementation. If you fork it for production
use, put a real disclosure process here before launch.
