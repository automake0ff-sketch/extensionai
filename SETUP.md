# Local setup

## 1. Prerequisites

- Node.js 20+
- A Firebase project (Spark/free tier is enough for development) with
  **Firestore** and **Authentication** enabled
- An Anthropic API key (or another provider you've wired into `lib/ai`)
- (Optional) the [Firebase CLI](https://firebase.google.com/docs/cli) if you
  want to deploy `firestore.rules` / `firestore.indexes.json` from the
  command line instead of the console

## 2. Install dependencies

```bash
npm install
```

## 3. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com/):

1. Create a project (or reuse one).
2. **Build → Firestore Database → Create database** (any region; start in
   production mode — the app ships its own rules, see step 5).
3. **Build → Authentication → Get started**, then enable:
   - **Email/Password**
   - **GitHub** and/or **Google** if you want the OAuth buttons on the login
     page to work. For GitHub, you'll need a GitHub OAuth App with the
     callback URL Firebase shows you on that provider's setup screen.

## 4. Get your app config and a service account key

- **Client config:** Project settings → General → "Your apps" → add a Web
  app if you haven't already → copy the `firebaseConfig` values.
- **Admin credentials:** Project settings → Service accounts → "Generate new
  private key". This downloads a JSON file with `project_id`, `client_email`,
  and `private_key` — you'll paste these into `.env.local` in the next step.
  **Never commit this file.**

## 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the `NEXT_PUBLIC_FIREBASE_*` values from the client config, and
`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` from
the service account JSON (keep the private key's `\n` sequences literal — the
app converts them to real newlines at startup). Also set `AI_API_KEY`.

## 6. Deploy Firestore rules and indexes

The app denies all direct client access to Firestore by design (every read/write
goes through a server-side Route Handler using the Admin SDK — see
ARCHITECTURE.md), and a couple of queries need composite indexes. Deploy both:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

(or paste the contents of `firestore.rules` into the console's Rules editor,
and create the two composite indexes listed in `firestore.indexes.json`
manually under Firestore → Indexes if you'd rather not install the CLI).

## 7. (Optional) enable GitHub export

To let people export a project straight to a new GitHub repository (as
opposed to just downloading the ZIP):

1. Create an OAuth App at <https://github.com/settings/developers> → "New
   OAuth App". Set the callback URL to `<your-app-url>/api/github/callback`.
2. Copy the Client ID and generate a Client Secret into
   `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.
3. Generate an encryption key for the stored token:
   `openssl rand -base64 32` → `APP_ENCRYPTION_KEY`.

Without these three variables, the "Connect GitHub" button in Settings
redirects back with a friendly "not configured" message instead of erroring.

## 8. (Optional) enable billing

To let people upgrade to Pro/Pro+ via Stripe Checkout:

1. In the [Stripe dashboard](https://dashboard.stripe.com) (test mode is
   fine), create two recurring **Prices** (Product catalog → Add product) —
   one for Pro, one for Pro+.
2. Copy their price IDs (start with `price_...`, not the product ID) into
   `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PRO_PLUS`.
3. Copy your secret key (Developers → API keys) into `STRIPE_SECRET_KEY`.
4. Register a webhook endpoint at `<your-app-url>/api/billing/webhook`
   subscribed to `checkout.session.completed`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. For local testing,
   use `stripe listen --forward-to localhost:3000/api/billing/webhook`
   instead and use the secret it prints.

Without these variables, Settings still shows plan/usage — the upgrade
buttons will just fail with a friendly error until configured.

## 9. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`, sign up, and create a project from
`/projects/new`.

## 10. Before shipping a change

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
