# FigBack

FigBack turns Figma comments into structured, prioritized feedback digests.

## One-click deploy (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiroslavgruevski-dsgn%2FFigBack&env=DATABASE_URL,AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET,AUTH_SECRET,FIGMA_ACCESS_TOKEN,CRON_SECRET,IMAGE_SIGN_SECRET,NEXT_PUBLIC_APP_URL,ALLOWED_EMAIL_DOMAIN,GOOGLE_GENERATIVE_AI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY)

After deploy, sign in and complete `/setup`. The app redirects to setup until required checks pass.

## What teammates need to know

- Cloning this repo gives you code, not app data.
- Each teammate should use their own `DATABASE_URL` for a clean environment.
- Secrets are not shared through git. Every teammate sets their own `.env.local`.

## 10-minute local setup

1. Install Node and dependencies
   - Node `20.19+`
   - `npm install`
2. Create env file
   - `cp .env.example .env.local`
3. Fill required env vars (see next section)
4. Run DB migration
   - `npx prisma migrate deploy`
5. Start app
   - `npm run dev`
6. Open `http://localhost:3000`
7. Complete `/setup` once (the wizard checks DB, auth, Figma, LLM, and cron configuration)

## Required env vars for local run

At minimum, set these in `.env.local`:

- `DATABASE_URL`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_SECRET`
- `ALLOWED_EMAIL_DOMAIN` (set `symphony.is` if you want only Symphony emails)
- `FIGMA_ACCESS_TOKEN`
- One LLM key:
  - `GOOGLE_GENERATIVE_AI_API_KEY`, or
  - `OPENAI_API_KEY`, or
  - `ANTHROPIC_API_KEY`
- `IMAGE_SIGN_SECRET`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Full reference is in [`.env.example`](.env.example).

## Google auth behavior

- The login flow always shows Google account picker.
- Domain restriction is enforced by `ALLOWED_EMAIL_DOMAIN`.
- If teammates deploy forks/branches, each deployment URL must be added to Google OAuth redirect URIs.

## Shared repo, isolated environments

For team collaboration:

- Share one repo.
- Use separate DBs and secrets per person or per team deployment.
- Do not point teammates to the same production database unless intentionally sharing data.

## Useful commands

- `npm run dev` - start local app
- `npm run build` - production build
- `npm run check` - lint + typecheck
- `npm run test:unit` - unit tests
- `npm run db:migrate` - apply migrations
- `npm run db:studio` - inspect DB

## Troubleshooting first run

- Auth fails: check `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, redirect URI.
- Sign-in blocked: verify `ALLOWED_EMAIL_DOMAIN`.
- Project create/sync fails: check `FIGMA_ACCESS_TOKEN`.
- No AI summary: check chosen LLM key in env or Settings.

## More docs

- [Deployment guide](docs/deployment.md)
- [Operations runbook](docs/runbook.md)
- [Architecture overview](docs/architecture.md)
- [Security guide](docs/security.md)
- [Project creation triage](docs/create-project-triage.md)

## Security basics

- Never commit `.env.local`.
- Never share real tokens in chat, tickets, or screenshots.
- Use least-privilege API tokens.

## License

MIT
