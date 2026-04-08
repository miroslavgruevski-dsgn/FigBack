import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { JobType, JobStatus } from "@/types/digest";

export async function createJob(
  type: JobType,
  projectId: string | null,
  payload: Record<string, string>,
  nextJobId?: string
) {
  return prisma.job.create({
    data: {
      type,
      projectId,
      payload: payload as unknown as Prisma.InputJsonValue,
      nextJobId: nextJobId ?? null,
    },
  });
}

export async function createJobChain(
  projectId: string,
  steps: { type: JobType; payload: Record<string, string> }[]
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

export async function claimJob(jobId: string) {
  try {
    return await prisma.job.update({
      where: { id: jobId, status: "pending" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
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

  return prisma.job.update({
    where: { id: jobId },
    data: { status, error, doneAt: shouldRetry ? null : new Date() },
  });
}

const STUCK_RUNNING_MS = 2 * 60 * 1000; // 2 minutes

export async function recoverStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_RUNNING_MS);
  const stuck = await prisma.job.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
  });
  for (const job of stuck) {
    const shouldRetry = job.attempts < job.maxRetries;
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "pending" : "failed",
        error: "Timed out (stuck)",
        doneAt: shouldRetry ? null : new Date(),
      },
    });
  }
  return stuck.length;
}

export async function getNextPendingJob() {
  await recoverStuckJobs();
  return prisma.job.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function hasActiveJob(projectId: string, type: string) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  const existing = await prisma.job.findFirst({
    where: {
      projectId,
      type,
      status: { in: ["pending", "running"] },
      createdAt: { gt: cutoff },
    },
  });
  return existing;
}

export async function expireStaleJobs(projectId: string) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  await prisma.job.updateMany({
    where: {
      projectId,
      status: { in: ["pending", "running", "waiting"] },
      createdAt: { lt: cutoff },
    },
    data: { status: "failed", error: "Expired (stale)", doneAt: new Date() },
  });
}
