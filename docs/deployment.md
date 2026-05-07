# Deployment Guide

This guide covers production deployment of FigBack on Vercel.

## One-click deploy

Use this deploy button to create a new Vercel project with the required env var prompts:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiroslavgruevski-dsgn%2FFigBack&env=DATABASE_URL,AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET,AUTH_SECRET,FIGMA_ACCESS_TOKEN,CRON_SECRET,IMAGE_SIGN_SECRET,NEXT_PUBLIC_APP_URL,ALLOWED_EMAIL_DOMAIN,GOOGLE_GENERATIVE_AI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY)

After first sign-in, open `/setup` and complete the required checks before team rollout.

## Quick teammate onboarding

Use this when a colleague clones or forks the repo.

1. Copy env template: `cp .env.example .env.local`
2. Set their own `DATABASE_URL` (clean data unless they point to shared DB)
3. Set Google OAuth credentials and `AUTH_SECRET`
4. Set `ALLOWED_EMAIL_DOMAIN=symphony.is` if domain-restricted access is required
5. Set `FIGMA_ACCESS_TOKEN` and one LLM key
6. Run:
   - `npx prisma migrate deploy`
   - `npm run dev`
7. Verify login and create/sync flow

Git does not share secrets or database contents. Those are per environment.

## 1) Prerequisites

- **Node.js 20.19+** for local development and running tests (`npm run test:unit`). The repo declares this in [`package.json`](../package.json) `engines` and [`.nvmrc`](../.nvmrc). Vercel uses your chosen Node version in Project Settings; align it with 20.19+.
- GitHub repository access
- Vercel account
- PostgreSQL database (Neon via Vercel Storage is recommended)
- Google OAuth credentials
- Figma personal access token
- At least one LLM provider API key

## Private team deployment model (recommended)

If teams are unrelated, each team should run a fully separate deployment.

Use one shared codebase, but separate everything else:

- Separate Vercel project per team
- Separate PostgreSQL database per team
- Separate OAuth app credentials per team (or separate OAuth client per deployment)
- Separate API keys and integration tokens per team
- Separate secrets per team (`AUTH_SECRET`, `CRON_SECRET`, `IMAGE_SIGN_SECRET`)
- Separate domain/subdomain per team

This prevents cross-team data and config access by design.

Do not share:

- Database instances
- Environment variables
- OAuth credentials
- Figma/LLM/Slack/Confluence tokens

Recommended repo strategy:

- Keep one upstream repository.
- Each team deploys from its own private fork or private branch with independent Vercel ownership.

## 2) Create the Vercel project

1. Import the repository into Vercel.
2. Create and attach a Postgres database.
3. Keep the default build command (`npm run build`).

## 3) Configure environment variables

Set these in Vercel Project Settings -> Environment Variables:

Required:

- `DATABASE_URL`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `FIGMA_ACCESS_TOKEN`
- One LLM key:
  - `GOOGLE_GENERATIVE_AI_API_KEY`, or
  - `OPENAI_API_KEY`, or
  - `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `IMAGE_SIGN_SECRET`
- `NEXT_PUBLIC_APP_URL` (your deployed app URL)

Optional but recommended:

- `ALLOWED_EMAIL_DOMAIN` (for domain-restricted access)
- `SETTINGS_ADMIN_EMAILS` (comma-separated emails allowed to update settings)
- `BLOB_READ_WRITE_TOKEN` (if using blob exports)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

For variable details, see [`.env.example`](../.env.example).

## 4) Configure Google OAuth

Set authorized redirect URI:

- `https://<your-domain>/api/auth/callback/google`

If testing locally too, also add:

- `http://localhost:3000/api/auth/callback/google`

## 5) Configure cron

Cron is defined in [`vercel.json`](../vercel.json):

| Path | Schedule | Role |
|------|----------|------|
| `/api/cron/check-comments` | `0 9 * * *` | Daily watch-mode sync for projects |
| `/api/cron/process-jobs` | `*/5 * * * *` | Drain one pending job per tick |
| `/api/cron/archive-idle` | `0 4 * * 0` | Weekly soft-archive of idle projects (uses **Archive after (days)** in Settings) |

Secured cron routes accept Vercel’s `x-vercel-cron: 1`, or `Authorization: Bearer <CRON_SECRET>`, or `?secret=` for local runs. `check-comments` still uses bearer-only in its handler; align `CRON_SECRET` in the environment for manual tests.

## 6) Deploy and verify

After setting env vars, deploy and verify:

1. `GET /api/health` returns `{ "status": "ok" }` and `GET /api/health/ready` returns `200` when DB and required env checks pass.
2. Google sign-in works.
3. `/setup` shows all required checks as complete.
4. You can create a project with a Figma URL.
5. Sync completes and digest generation works.
6. Cron route returns success with valid bearer token.

## Team handoff checklist (private isolated setup)

Use this when onboarding another team:

1. They create their own private repo copy (fork or clone to new repo).
2. They create their own Vercel project under their own account/team.
3. They provision their own database.
4. They generate their own OAuth credentials and provider tokens.
5. They set their own environment variables and secrets.
6. They deploy and run verification checks.
7. They confirm they cannot access your domain, DB, or secrets.
8. You confirm you cannot access theirs.

## Data safety guarantees during hardening

Production hardening must not wipe existing settings or project data.

Apply these rules:

- Use non-destructive migrations by default.
- Never drop tables/columns or truncate data unless explicitly approved.
- Back up the production database before risky migrations.
- Validate migration behavior in staging first.
- Keep rollback notes for every schema-related release.

## 7) Recommended production hardening

- Rotate secrets regularly.
- Restrict `ALLOWED_EMAIL_DOMAIN`.
- Add CI gates for unit tests and migration checks.
- Monitor job failures and provider error rates.
- Keep dependencies patched.

## 8) Rollback checklist

If deployment fails:

1. Roll back to previous Vercel deployment.
2. Confirm DB is reachable with current `DATABASE_URL`.
3. Confirm all required env vars exist in target environment.
4. Check build and runtime logs for migration/env/auth errors.
5. Re-run verification checks after rollback.
