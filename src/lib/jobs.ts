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
  return prisma.job.update({
    where: { id: jobId, status: "pending" },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });
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

export async function getNextPendingJob() {
  return prisma.job.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
}

export async function hasActiveJob(projectId: string, type: string) {
  const existing = await prisma.job.findFirst({
    where: {
      projectId,
      type,
      status: { in: ["pending", "running"] },
    },
  });
  return existing;
}
