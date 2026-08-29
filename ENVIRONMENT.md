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
| `APP_ENCRYPTION_KEY` | Yes, if GitHub export is enabled | **No** | AES-256-GCM key (32 bytes, base64) used to encrypt the GitHub access token before it's stored in Firestore. Generate with `openssl rand -base64 32`. |
| `AI_PROVIDER` | Yes | No | Selects the implementation in `lib/ai/providers/`. Currently only `"anthropic"`. |
| `AI_API_KEY` | Yes | No | Secret key for the configured provider. |
| `AI_MODEL` | No | No | Overrides the provider's default model string. |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | No — enables GitHub *export* (create repo/commit) if set | No | From a GitHub OAuth App (see SETUP.md). Not to be confused with "Sign in with GitHub", which is configured entirely in the Firebase console. |
| `STRIPE_SECRET_KEY` | No — enables billing if set | **No** | Server-side Stripe API key. |
| `STRIPE_WEBHOOK_SECRET` | No — required once billing is enabled | **No** | Verifies that `/api/billing/webhook` requests actually came from Stripe. |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_PLUS` | No — required once billing is enabled | No | Stripe recurring Price IDs for the two paid plans. |

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
