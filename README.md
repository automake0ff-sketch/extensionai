# ExtenAI

Describe a browser extension in plain English and get a working Chrome
extension (Manifest V3) you can preview, edit by chatting, validate, and
download as a ZIP.

```
Describe → Generate → Preview → Chat to modify → Validate → Download ZIP → Load unpacked
```

This repository implements the P0 flow end to end: auth, project creation,
AI generation (Architect → Coder), a code editor, chat-driven modification
(Modifier), a security/manifest validator, static test planning (Tester),
and ZIP export. See [ROADMAP.md](./ROADMAP.md) for what's intentionally not
built yet (Stripe billing, GitHub export, automated Chrome Web Store
publishing) and why.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Firebase + AI provider keys
npm run dev
```

See [SETUP.md](./SETUP.md) for the full local setup (including the Firebase
project) and [ENVIRONMENT.md](./ENVIRONMENT.md) for what each variable does.

## Scripts

```bash
npm run dev        # local dev server
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run build        # production build
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit together
- [SETUP.md](./SETUP.md) — local development setup
- [ENVIRONMENT.md](./ENVIRONMENT.md) — environment variables
- [SECURITY.md](./SECURITY.md) — security model and constraints
- [ROADMAP.md](./ROADMAP.md) — what's built, what's stubbed, what's next
- [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) — what's code-complete vs.
  what still needs a real Firebase/Stripe/GitHub setup and legal review
  before you launch to real users
