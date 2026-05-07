# Architecture Overview

This document describes how FigBack is structured in production.

## High-level system

FigBack is a Next.js application with API routes, PostgreSQL persistence, and background job processing for sync and analysis workflows.

Core runtime pieces:

- Next.js App Router pages and components
- API routes in `src/app/api/**`
- Prisma + PostgreSQL data layer
- Job orchestration using the `Job` table
- External integrations (Figma, LLM providers, Slack, Confluence)

## Main flow

1. User signs in with Google OAuth.
2. User creates project and links Figma files.
3. Sync pulls Figma comments and stores them in DB.
4. Analysis pipeline creates review cards, classifies issues, clusters them, and prepares digest views.
5. Optional integrations post summaries to Slack/Confluence.

## Current analysis behavior

- Analysis cards on the project page are optimized for scanability: latest marker, run timestamp, key counts, compact AI summary, and optional details expansion.
- Completion is hybrid:
  - manual triage status from issue workflow (`open`, `in_progress`, `done`, `dismissed`)
  - comment-level resolved signal from synced Figma `resolvedAt`.
- Repeated logical issues across rounds use canonical identity (`IssueCluster.canonicalKey`) so triage updates can propagate within the same project.

## App structure

- `src/app/**`: pages, layouts, and route handlers
- `src/components/**`: reusable UI components
- `src/lib/**`: domain logic, integrations, job helpers, utilities
- `prisma/**`: schema and migrations
- `docs/**`: deployment, runbook, and troubleshooting docs

## Data model (core entities)

Defined in [`prisma/schema.prisma`](../prisma/schema.prisma).

- `Project`: top-level container
- `FigmaFile`: linked Figma files per project
- `Comment`: synced Figma comments
- `ReviewRound`: one analysis run
- `ReviewCard`: normalized thread card for analysis
- `LLMAssessment`: classification result per card
- `IssueCluster`: grouped issues for digest output
- `Job`: async workflow queue and progress state
- `TeamConfig`: global integration/config values

## API and background processing

Important route groups:

- `src/app/api/projects/**`: project and file operations
- `src/app/api/sync/route.ts`: enqueue sync
- `src/app/api/jobs/run/route.ts`: execute queued work
- `src/app/api/digest/route.ts`: trigger digest generation
- `src/app/api/cron/check-comments/route.ts`: scheduled check flow

## External integrations

- Figma API for file metadata and comments
- LLM providers for issue classification and summaries
- Slack webhook for digest notifications
- Confluence API for posting reports

## Operational boundaries

- App and API logic run in Next.js runtime.
- Data persistence is PostgreSQL via Prisma.
- Cron cadence is configured in [`vercel.json`](../vercel.json).
- Environment configuration is documented in [`.env.example`](../.env.example).

## Known architecture priorities

- Strengthen object-level authorization and access boundaries.
- Improve queue durability and retry strategies.
- Increase observability with metrics/alerts in addition to logs.
- Expand CI gates for tests and migration safety.
- Continue strengthening cross-round issue identity quality and propagation safety.
