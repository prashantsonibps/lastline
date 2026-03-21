import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { ensureDir } from "@/lib/fs-utils";
import { listDurableJsonPaths, readDurableJson, writeDurableJson } from "@/lib/durable-json-store";
import type { ChangedFile, RepoRef, ReviewJob, ReviewRuntimeConfig } from "@/lib/types";

const JOB_FILE_NAME = "job.json";
const jobUpdateQueues = new Map<string, Promise<ReviewJob>>();
const JOBS_STORE_PREFIX = "state/review-jobs";

function getJobDir(jobId: string) {
  return path.join(config.jobsRootDir, jobId);
}

function getJobFile(jobId: string) {
  return `${JOBS_STORE_PREFIX}/${jobId}/${JOB_FILE_NAME}`;
}

function createBaseJob(input: {
  repo: RepoRef;
  pr: ReviewJob["pr"];
  changedFiles: ChangedFile[];
  runtime?: ReviewRuntimeConfig;
}) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const jobDir = getJobDir(id);

  return {
    id,
    repo: input.repo,
    pr: input.pr,
    changedFiles: input.changedFiles,
    runtime: input.runtime ?? {},
    status: "queued",
    tasks: [],
    createdAt,
    updatedAt: createdAt,
    workspaceDir: path.join(jobDir, "workspace"),
    outputDir: path.join(jobDir, "output"),
    logs: [],
    feedback: {
      conversation: { step: "idle" },
      findings: [],
      screenshotsByTimestamp: {},
      createdIssues: [],
    },
  } satisfies ReviewJob;
}

export async function persistReviewJob(job: ReviewJob) {
  await ensureDir(getJobDir(job.id));
  await writeDurableJson(getJobFile(job.id), job);
}

export async function createManualReviewJob(input: {
  repo: RepoRef;
  pr: ReviewJob["pr"];
  changedFiles: ChangedFile[];
  runtime?: ReviewRuntimeConfig;
}) {
  const job = createBaseJob(input);
  await persistReviewJob(job);
  return job;
}

export async function getReviewJob(jobId: string) {
  return readDurableJson<ReviewJob>(getJobFile(jobId));
}

export async function updateReviewJob(jobId: string, updater: (job: ReviewJob) => ReviewJob | Promise<ReviewJob>) {
  const previous = jobUpdateQueues.get(jobId) ?? Promise.resolve(undefined as never);

  const next = previous
    .catch(() => undefined as never)
    .then(async () => {
      const existingJob = await getReviewJob(jobId);

      if (!existingJob) {
        throw new Error(`Review job ${jobId} not found.`);
      }

      const nextJob = await updater(existingJob);
      nextJob.updatedAt = new Date().toISOString();
      await persistReviewJob(nextJob);

      return nextJob;
    });

  jobUpdateQueues.set(jobId, next);

  try {
    return await next;
  } finally {
    if (jobUpdateQueues.get(jobId) === next) {
      jobUpdateQueues.delete(jobId);
    }
  }
}

export async function appendJobLog(jobId: string, message: string) {
  return updateReviewJob(jobId, (job) => ({
    ...job,
    logs: [...job.logs, `[${new Date().toISOString()}] ${message}`],
  }));
}

export async function listReviewJobs() {
  const jobPaths = await listDurableJsonPaths(JOBS_STORE_PREFIX);
  const jobIds = Array.from(
    new Set(
      jobPaths
        .map((pathname) => pathname.match(/^state\/review-jobs\/([^/]+)\/job\.json$/)?.[1])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const jobs = await Promise.all(jobIds.map((jobId) => getReviewJob(jobId)));

  return jobs
    .filter((job): job is ReviewJob => Boolean(job))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
