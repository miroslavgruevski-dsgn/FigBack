# Security Guide

This document captures baseline security practices for FigBack.

## Security principles

- Keep secrets out of source control.
- Use least-privilege tokens and credentials.
- Restrict access by identity and domain.
- Validate and sanitize all external input.
- Prefer explicit authorization checks for sensitive routes.

## Authentication and access

- Auth is Google OAuth via Auth.js.
- Sign-in uses Google account chooser (`prompt=select_account`).
- Optional domain restriction uses `ALLOWED_EMAIL_DOMAIN`.
- Middleware enforces route protection boundaries.

Required controls:

- Keep OAuth redirect URIs exact and environment-specific.
- Limit production access to approved domains/users.
- Review privileged routes before each release.

## Secrets management

Secrets come from environment variables and optional settings storage.

Critical secrets:

- `AUTH_SECRET`
- `CRON_SECRET`
- `IMAGE_SIGN_SECRET`
- `FIGMA_ACCESS_TOKEN`
- LLM provider keys
- Integration credentials (Slack/Confluence)

Rules:

- Never commit `.env.local`.
- Rotate secrets after suspected exposure.
- Scope Figma and provider tokens to minimum permissions.
- Do not share tokens in tickets, chat, or logs.

## API security controls

Current controls include:

- CSRF origin checks on mutating routes.
- Input validation (Zod) on selected API handlers.
- Auth middleware for non-public routes.

Recommended hardening:

- Add consistent rate limiting on expensive routes.
- Ensure stable sanitized error responses from all APIs.
- Enforce object-level authorization checks per resource.

## Cron and internal endpoints

- Cron routes accept Vercel cron header (`x-vercel-cron: 1`) in production schedules.
- Manual/local invocation should use `Authorization: Bearer <CRON_SECRET>`.
- Keep `CRON_SECRET` unique per environment.
- Do not expose cron secrets in client-side code.

## Team setup boundaries

- Git clone or fork shares code only.
- Secrets and database data are environment-specific.
- Each teammate should set their own `.env.local` and database unless intentional shared data access is needed.

## Deployment security checklist

Before production deploy:

1. Confirm all required env vars are set.
2. Confirm OAuth redirect URIs match deployed domain.
3. Confirm `ALLOWED_EMAIL_DOMAIN` policy is intentional.
4. Confirm cron auth secret is configured.
5. Confirm no debug/test secrets are enabled in production.

After deploy:

1. Verify `/api/health` and `/api/health/ready`.
2. Verify sign-in flow.
3. Verify project creation and sync.
4. Review logs for auth/integration errors.

## Incident response for security events

If token or credential leak is suspected:

1. Rotate compromised credentials immediately.
2. Invalidate sessions if needed.
3. Review recent logs and affected actions.
4. Patch root cause.
5. Document incident and prevention actions.

## Related docs

- [Deployment guide](./deployment.md)
- [Operations runbook](./runbook.md)
- [Project creation triage](./create-project-triage.md)
- [Environment variables reference](../.env.example)
