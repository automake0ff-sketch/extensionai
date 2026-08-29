# Architecture

## Stack

- **Frontend/Backend:** Next.js (App Router) + TypeScript + React, using
  Next's server-side capabilities (Route Handlers, Server Components) as the
  backend — there is no separate API server.
- **Database:** Firestore (via the Firebase Admin SDK, server-side only).
- **Auth:** Firebase Authentication (email/password + GitHub/Google OAuth via
  popup), backed by an httpOnly session cookie for server-side verification.
- **Styling:** Tailwind CSS, hand-built components (no full component
  library).

## Directory layout

```
src/
  app/
    page.tsx                    Landing page
    login/page.tsx               Login (thin Suspense wrapper)
    (app)/                       Authenticated route group (shared sidebar)
      dashboard/page.tsx
      projects/new/page.tsx
      projects/[id]/page.tsx     Main product screen (editor/chat/preview)
      settings/page.tsx
    api/
      auth/session/route.ts      Exchanges a Firebase ID token for a session cookie
      files/route.ts              Manual file edits from the editor
      projects/route.ts           Create/list projects
      generate/route.ts           Full generation pipeline
      modify/route.ts             Chat-driven modification
      validate/route.ts           Extension health check
      export/route.ts             ZIP download
      tests/route.ts               Static test plan
      analyze/route.ts             Reviewer pass
      store-prep/route.ts          Chrome Web Store checklist (no auto-publish)
  lib/
    ai/                          Provider-agnostic AI layer (see below)
    firebase/
      admin.ts                    Server-only Firebase Admin SDK singleton
      client.ts                   Browser Firebase Auth singleton
      session.ts                  Session-cookie verification helpers
      firestore.ts                 All Firestore reads/writes, with ownership checks
    validator/                    Manifest + security static checks
    zip/                          ZIP building
    usage/                        Credit accounting
    types/                        Shared domain types
  components/
    editor/                      Workspace: file tree, code editor, preview,
                                  validator panel, test plan panel, store prep
    app/                          Login form, sign-out button
    brand/                        Small shared UI pieces
firestore.rules                    Deny-all rules (see "Security model" below)
firestore.indexes.json              Composite indexes the queries need
firebase.json                       Points the Firebase CLI at the two files above
src/proxy.ts                        Next.js "proxy" (formerly middleware) — cookie-presence redirect only
```

## Auth model

There is **no client-side Firestore/Auth SDK access to app data** — the
browser only ever talks to Firebase Auth (to sign in) and to ExtenAI's own
API routes (for everything else). The flow:

1. The browser calls Firebase Auth directly (`signInWithEmailAndPassword`,
   `createUserWithEmailAndPassword`, or `signInWithPopup` for GitHub/Google) —
   see `src/components/app/login-form.tsx`.
2. On success, the client calls `credential.user.getIdToken()` and POSTs it to
   `POST /api/auth/session`.
3. That route (`src/app/api/auth/session/route.ts`) verifies the ID token with
   the Admin SDK, mints a long-lived **session cookie**
   (`adminAuth().createSessionCookie(...)`), sets it as `httpOnly`, and — the
   Firestore equivalent of a "new user" trigger — creates a `profiles/{uid}`
   document if one doesn't exist yet.
4. Every Server Component and Route Handler that needs to know who's asking
   calls `getSession()` / `requireSession()` (`src/lib/firebase/session.ts`),
   which reads that cookie and verifies it server-side with the Admin SDK.
5. `src/proxy.ts` (Next's replacement for `middleware.ts`) only checks
   whether the cookie is *present*, purely for a fast redirect to `/login`
   before a protected page even renders. It does **not** verify the cookie's
   signature or expiry — `firebase-admin` needs a Node.js runtime the proxy
   may not run under. The actual security boundary is step 4, which runs on
   every request that touches data, so a forged/expired cookie can skip the
   convenience redirect but can never pass a real ownership check.
6. Sign-out clears the client Firebase Auth session and calls
   `DELETE /api/auth/session` to drop the cookie.

## The AI layer (`src/lib/ai`)

Unchanged by the Firebase migration — this layer never depended on the
database. The rest of the app calls four functions from `lib/ai/extension.ts`:

- `generateExtension(prompt)` — **Architect** then **Coder** prompts, Zod-validated.
- `modifyExtension({ userMessage, files, recentMessages })` — **Modifier**
  prompt, returns a diff (`create`/`update`/`delete` per file).
- `analyzeExtension(files)` — **Reviewer** prompt.
- `generateTests(files)` — **Tester** prompt; never claims a test executed.

`getAiProvider()` reads `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` and returns
an `AiProvider` (`lib/ai/provider.ts` is the interface;
`lib/ai/providers/anthropic.ts` the only implementation). Every AI response
is parsed through a Zod schema (`lib/ai/schemas.ts`) before it's written to
Firestore.

## Firestore schema (`src/lib/firebase/firestore.ts`)

```
profiles/{uid}                        { id, email, name, avatarUrl, plan, createdAt }

projects/{projectId}                  { userId, name, description, status, manifestSummary, createdAt, updatedAt }
  files/{autoId}                      { path, content, createdAt, updatedAt }
  versions/{autoId}                   { path, content, versionNumber, createdBy, createdAt }
  generations/{autoId}                { userId, kind, prompt, model, status, errorMessage, tokensUsed, createdAt }
  messages/{autoId}                   { userId, role, content, createdAt }

usage/{uid}_{period}                  { userId, period, creditsUsed }
```

Notes:

- `files` and `versions` are subcollections keyed by auto-ID, with `path` as
  a **field** rather than the document ID, since Firestore document IDs
  can't contain `/` and paths look like `src/popup.js`.
- Every read/write in `lib/firebase/firestore.ts` uses the **Admin SDK**,
  which bypasses Firestore Security Rules entirely. That's why every
  exported function takes the ownership check as part of its contract (e.g.
  `getOwnedProject(uid, projectId)` returns `null` if the project exists but
  belongs to someone else) — see "Security model" below for why this is safe
  despite bypassing rules.

## Data flow for generation

1. Client calls `POST /api/projects` to create a project doc (`status: draft`).
2. Client calls `POST /api/generate` with `{ projectId, prompt }`.
3. The route checks the user's credit usage, sets `status: generating`,
   creates a `generations` doc, calls `generateExtension()`, then:
   - replaces every doc in `files` for that project with the returned files
     (`replaceProjectFiles` — delete-all + batch-write in one Firestore batch),
   - sets `status: ready` (or `error` on failure),
   - records credit usage,
   - appends the user prompt + a summary assistant message to `messages`.

## Data flow for modification

`POST /api/modify` loads the project's current files and the last N chat
messages, calls `modifyExtension()`, and for every changed file:

1. Snapshots the **current** content into `versions` (only if the file
   already existed) before touching it — `snapshotFileVersion`.
2. Applies the change (`create`/`update` → `upsertProjectFile`, `delete` →
   `deleteProjectFileByPath`).
3. Returns the **fresh full file list** in the response, since the browser
   has no direct Firestore access to re-fetch it itself.

This is the section 11/12 requirement: every AI edit is recoverable, even
though the MVP doesn't yet expose a full visual diff/accept/reject UI — the
`versions` subcollection is the durable safety net regardless of what the UI
shows.

## Validator, ZIP export, preview

Unchanged by the migration — see the previous write-up below, still accurate:

- **Validator** (`src/lib/validator`) — `validateProject(files)` runs
  manifest checks, referenced-file checks, and a security pattern scan
  (`eval`, `new Function`, hardcoded secrets, remote scripts, broad
  permissions). Same function backs the editor's "Health" panel and the
  pre-export check.
- **Preview** (`src/components/editor/extension-preview.tsx`) — explicitly
  *not* a real running extension. Renders the actual `popup.html` markup in
  a sandboxed iframe plus a parsed manifest summary, and says so in the UI.
- **ZIP export** (`src/lib/zip/build.ts`, `POST /api/export`) — bundles the
  project's current files into a ZIP loadable via `chrome://extensions` →
  Developer mode → Load unpacked.

## Security model

See `SECURITY.md` for the full write-up. In short: Firestore Security Rules
(`firestore.rules`) deny **all** direct client access — every read/write
goes through a Route Handler using the Admin SDK, and each Firestore helper
function checks `userId` ownership in code before returning or mutating
anything. This mirrors what Postgres Row Level Security used to enforce
automatically, just moved into the application layer since Firestore rules
can't easily express "walk up to the parent project doc and check its
`userId`" for every subcollection query the way a SQL `EXISTS` policy could.
