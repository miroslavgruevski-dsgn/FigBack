# Operations Runbook

This runbook is for operating FigBack in production.

## Service overview

FigBack processes Figma comments into analysis digests.

Key components:

- Web app and API routes (Next.js)
- PostgreSQL (Prisma)
- Background job processing via `Job` records
- External providers:
  - Figma API
  - LLM provider
  - Slack/Confluence (optional)

## Core health checks

- `GET /api/health` returns liveness (`200`, `{ "status": "ok" }`). Safe for frequent probes.
- `GET /api/health/ready` returns readiness: DB ping, env checks for global Figma token and LLM keys, plus `queue.activeOrDue` (pending/running/waiting jobs that are due). Use for load balancers and on-call dashboards.
- Auth callback route must work:
  - `/api/auth/callback/google`
- Queue progression should continue when jobs are pending: ensure `/api/cron/process-jobs` is scheduled (Vercel cron) or another worker calls `POST /api/jobs/run` with auth.

### Alerts (suggested)

- **Ready check fails** (`GET /api/health/ready` not `200`) for more than 2 minutes: page DB or required env.
- **`queue.activeOrDue` high** (e.g. &gt; 50 for 15+ minutes): workers not draining; check job logs, Figma/LLM errors, and cron/worker schedule.
- **Spike in `Job.status = failed`**: inspect `Job.error` and provider credentials.

## Daily operational checks

1. Check app and API error logs.
2. Check for repeated failed jobs.
3. Confirm cron execution for `/api/cron/check-comments`, `/api/cron/process-jobs`, and weekly `/api/cron/archive-idle`.
4. Confirm Slack/Confluence integration errors are not accumulating.

## Common incidents

## 1) Project creation fails

Use the triage guide:

- [create-project-triage.md](./create-project-triage.md)

Check:

- API response `code`
- DB availability
- Duplicate Figma file key collisions
- CSRF origin mismatch

## 2) Sync jobs are stuck

Symptoms:

- Jobs remain `pending`/`running` for too long.
- UI does not show progress updates.

Actions:

1. Check `/api/jobs/run` logs.
2. Inspect recent `Job` rows for repeated failures.
3. Verify provider credentials (`FIGMA_ACCESS_TOKEN`, LLM key).
4. Retry queue trigger after fixing root cause.
5. If needed, mark irrecoverable jobs as failed and re-run from UI.

## 3) Google sign-in fails

Checks:

- OAuth client ID and secret are correct.
- Redirect URI matches exact deployed domain.
- `AUTH_SECRET` is present.
- `AUTH_TRUST_HOST=true` in hosted environments.

## 4) Cron route failures

Checks:

- `CRON_SECRET` set for routes that require manual/curl invocation.
- Vercel invokes crons with header `x-vercel-cron: 1` (see [Vercel cron docs](https://vercel.com/docs/cron-jobs)); `/api/cron/process-jobs` accepts that or `Authorization: Bearer <CRON_SECRET>` or `?secret=` for local testing.
- Deployment includes current `vercel.json` (both comment check and job drain schedules).

## 5) Auto-archive (retention)

Settings **Archive after (days)** maps to `TeamConfig.archiveDays`. The weekly cron `/api/cron/archive-idle` sets `Project.archived = true` when the latest activity (project update, file sync, or round sync) is older than that window. Nothing is deleted.

If projects disappear from the default list, check **Archived** filtering and `Project.archived` in the database. To undo: set `archived` back to `false` for affected rows.

Restore options:

- Project page action: `Restore` button on archived project.
- Dashboard archived view: `Restore` action directly on archived project cards.

## 6) Migration or deploy failure

Symptoms:

- App fails health/ready after deploy.
- Prisma errors on startup (`P2021`, missing column, migration pending).

Actions:

1. Stop routing traffic to the broken revision if you can (rollback in Vercel or revert the deployment).
2. Read the failing migration name from CI (`prisma migrate status`) or deploy logs.
3. Restore the database from backup before the bad migration if the migration partially applied (contact your DB provider’s restore flow).
4. Fix forward only after you understand the drift: either apply the missing migration safely or restore DB + redeploy the previous app revision.
5. Document what changed and re-run `npx prisma migrate status` against staging before retrying production.

## 7) Integration posting errors (Slack/Confluence)

Checks:

- Credentials and base URLs in Settings.
- Provider endpoint reachability.
- Error details in app logs and `lastIntegrationError`.

## 8) Team onboarding sanity checks

For a new teammate environment:

1. Confirm they created `.env.local` from `.env.example`.
2. Confirm they use their own `DATABASE_URL` for clean data.
3. Confirm OAuth redirect URI includes their local/deployed callback URL.
4. Confirm required tokens are set (`FIGMA_ACCESS_TOKEN`, one LLM key, `AUTH_SECRET`).
5. Confirm `ALLOWED_EMAIL_DOMAIN` policy matches team intent.

## Incident response workflow

1. Detect
   - Alert, user report, or error-rate spike.
2. Triage
   - Identify impact scope and affected features.
3. Mitigate
   - Disable broken integration, rollback deployment, or pause heavy workflows.
4. Recover
   - Restore service and confirm key flows.
5. Follow up
   - Record timeline, root cause, and prevention tasks.

## Escalation criteria

Escalate immediately when:

- Authentication is unavailable.
- Database is unreachable.
- Most job processing fails for more than 15 minutes.
- Data integrity is at risk (failed migrations, destructive errors).

## Change and release checklist

Before release:

1. Run `npm run check`.
2. Run `npm run test:unit`.
3. Run critical E2E smoke tests.
4. Verify migration plan.
5. Confirm required env vars in target environment.

After release:

1. Validate `/api/health` and `/api/health/ready`.
2. Validate sign-in flow.
3. Run one sync + digest generation.
4. Check logs for elevated error rates for 10-15 minutes.

## Secrets and access policy

- Do not share production secrets in chat or tickets.
- Rotate compromised or leaked tokens immediately.
- Keep least-privilege scopes for Figma and provider tokens.
- Never set `E2E_AUTH_SECRET` in production.
