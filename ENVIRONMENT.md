# Environment variables

All variables live in `.env.local` locally, and in your host's environment
variable settings in production (e.g. Vercel → Project → Settings →
Environment Variables). See `.env.example` for the canonical list.

| Variable | Required | Exposed to browser? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Yes | Firebase Web SDK config. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Yes | Firebase Web SDK config. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Yes | Firebase Web SDK config. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Yes | Firebase Web SDK config (unused today, reserved for future file uploads). |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Yes | Firebase Web SDK config. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Yes | Firebase Web SDK config. |
| `FIREBASE_PROJECT_ID` | Yes | **No** | Admin SDK service account — identifies the project for server-side Firestore/Auth calls. |
| `FIREBASE_CLIENT_EMAIL` | Yes | **No** | Admin SDK service account email. |
| `FIREBASE_PRIVATE_KEY` | Yes | **No** | Admin SDK service account private key. Grants full read/write to Firestore and full control of Auth — treat like any other master secret. |
| `AI_PROVIDER` | Yes | No | Selects the implementation in `lib/ai/providers/`. Currently only `"anthropic"`. |
| `AI_API_KEY` | Yes | No | Secret key for the configured provider. |
| `AI_MODEL` | No | No | Overrides the provider's default model string. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No (not wired up) | Mixed | Reserved for the billing phase — see ROADMAP.md. |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | No (not wired up) | No | Reserved for GitHub *export* (pushing a project to a new repo) — not to be confused with "Sign in with GitHub", which is configured entirely in the Firebase console instead. |

## Why the `NEXT_PUBLIC_FIREBASE_*` values are safe to expose

Unlike a typical API key, Firebase's client config only *identifies* your
project — it doesn't grant access on its own. Access control is enforced by
Firestore Security Rules and Firebase Auth, not by keeping this config
secret. That said, this app additionally denies **all** direct client
Firestore access (`firestore.rules`) and routes every read/write through a
server-side API route instead, so the client SDK here is only ever used for
`firebase/auth`, never `firebase/firestore`.

## Rules this codebase follows

- No secret is ever hardcoded — everything above is read via
  `process.env.*`.
- Server-only secrets (`FIREBASE_PRIVATE_KEY`, `AI_API_KEY`, Stripe secret
  key) are only referenced from files under `src/app/api/**`, `src/lib/ai/**`,
  or `src/lib/firebase/admin.ts` / `session.ts` — never from a file marked
  `"use client"`.
- `NEXT_PUBLIC_*` variables are the only ones safe to ship to the browser by
  Next.js convention; nothing outside that prefix is ever read from client
  code.
