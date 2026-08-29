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

## 7. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`, sign up, and create a project from
`/projects/new`.

## 8. Before shipping a change

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
