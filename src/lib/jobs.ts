import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { JobType, JobStatus } from "@/types/digest";

export async function createJob(
  type: JobType,
  projectId: string | null,
  payload: Record<string, unknown>,
  nextJobId?: string,
  status: JobStatus = "pending"
) {
  return prisma.job.create({
    data: {
      type,
      projectId,
      payload: payload as unknown as Prisma.InputJsonValue,
      nextJobId: nextJobId ?? null,
      status,
    },
  });
}

export async function createJobChain(
  projectId: string,
  steps: { type: JobType; payload: Record<string, unknown> }[]
) {
  if (steps.length === 0) return null;

  const jobs: { id: string }[] = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const nextJobId: string | undefined = jobs.length > 0 ? jobs[jobs.length - 1].id : undefined;
    const isFirst = i === 0;
    const job = await prisma.job.create({
      data: {
        type: steps[i].type,
        projectId,
        payload: steps[i].payload as unknown as Prisma.InputJsonValue,
        nextJobId: nextJobId ?? null,
        status: isFirst ? "pending" : "waiting",
      },
    });
    jobs.push(job);
  }

  return jobs[jobs.length - 1];
}

function retryDelayMs(attemptsAfterClaim: number): number {
  const base = 2000;
  const cap = 5 * 60 * 1000;
  const exp = Math.min(cap, base * Math.pow(2, Math.max(0, attemptsAfterClaim - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(cap, exp + jitter);
}

export async function claimJob(jobId: string) {
  try {
    return await prisma.job.update({
      where: { id: jobId, status: "pending" },
      data: {
        status: "running",
        startedAt: new Date(),
        attempts: { increment: 1 },
        nextRetryAt: null,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}

export async function completeJob(jobId: string) {
  const job = await prisma.job.update({
    where: { id: jobId },
    data: { status: "done", doneAt: new Date() },
  });

  if (job.nextJobId) {
    await prisma.job.update({
      where: { id: job.nextJobId },
      data: { status: "pending" },
    }).catch(() => {});
  }

  return job;
}

export async function failJob(jobId: string, error: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const shouldRetry = job.attempts < job.maxRetries;
  const status: JobStatus = shouldRetry ? "pending" : "failed";
  const nextRetryAt = shouldRetry
    ? new Date(Date.now() + retryDelayMs(job.attempts))
    : null;

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      error,
      doneAt: shouldRetry ? null : new Date(),
      nextRetryAt,
    },
  });
}

const STUCK_RUNNING_MS = 12 * 60 * 1000; // 12 minutes

export async function recoverStuckJobs(projectId?: string) {
  const cutoff = new Date(Date.now() - STUCK_RUNNING_MS);
  const stuck = await prisma.job.findMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
      ...(projectId ? { projectId } : {}),
    },
  });
  for (const job of stuck) {
    const shouldRetry = job.attempts < job.maxRetries;
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "pending" : "failed",
        error: "Timed out (stuck)",
        doneAt: shouldRetry ? null : new Date(),
        nextRetryAt: shouldRetry ? new Date(Date.now() + retryDelayMs(job.attempts)) : null,
      },
    });
  }
  return stuck.length;
}

export async function getNextPendingJob(projectId?: string) {
  await recoverStuckJobs(projectId);
  const now = new Date();
  return prisma.job.findFirst({
    where: {
      status: "pending",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function jobActivityCutoff(): Date {
  return new Date(Date.now() - STALE_THRESHOLD_MS);
}

export async function hasActiveJob(projectId: string, type: string) {
  const existing = await prisma.job.findFirst({
    where: {
      projectId,
      type,
      status: { in: ["pending", "running"] },
      createdAt: { gt: jobActivityCutoff() },
    },
  });
  return existing;
}

/** Active job (pending/running, not stale) with payload for roundId, etc. */
export async function findActiveJobWithPayload(
  projectId: string,
  type: string
): Promise<{ id: string; payload: Record<string, unknown> } | null> {
  const j = await prisma.job.findFirst({
    where: {
      projectId,
      type,
      status: { in: ["pending", "running"] },
      createdAt: { gt: jobActivityCutoff() },
    },
    select: { id: true, payload: true },
  });
  if (!j) return null;
  return { id: j.id, payload: j.payload as Record<string, unknown> };
}

const DEFAULT_ACTIVE_PIPELINE_TYPES = [
  "sync_full",
  "prepare_reanalysis",
  "classify",
  "cluster",
  "export_images",
] as const;

export async function findActivePipelineJob(
  projectId: string,
  types: string[] = [...DEFAULT_ACTIVE_PIPELINE_TYPES]
): Promise<{ id: string; type: string; payload: Record<string, unknown> } | null> {
  const j = await prisma.job.findFirst({
    where: {
      projectId,
      type: { in: types },
      status: { in: ["pending", "running", "waiting"] },
      createdAt: { gt: jobActivityCutoff() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, payload: true },
  });
  if (!j) return null;
  return { id: j.id, type: j.type, payload: j.payload as Record<string, unknown> };
}

export async function expireStaleJobs(projectId: string) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  await prisma.job.updateMany({
    where: {
      projectId,
      status: { in: ["pending", "waiting"] },
      createdAt: { lt: cutoff },
    },
    data: { status: "failed", error: "Expired (stale)", doneAt: new Date() },
  });
  await prisma.job.updateMany({
    where: {
      projectId,
      status: "running",
      startedAt: { lt: cutoff },
    },
    data: { status: "failed", error: "Expired (stale)", doneAt: new Date() },
  });
}

export async function findQueuedJobByPayload(
  projectId: string,
  type: JobType,
  payload: Record<string, unknown>
) {
  const jobs = await prisma.job.findMany({
    where: {
      projectId,
      type,
      status: { in: ["pending", "running", "waiting"] },
      createdAt: { gt: jobActivityCutoff() },
    },
    select: { id: true, payload: true },
  });

  const target = JSON.stringify(payload);
  const match = jobs.find((j) => JSON.stringify(j.payload) === target);
  if (!match) return null;
  return { id: match.id, payload: match.payload as Record<string, unknown> };
}
