import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { ensureDir, listDirectories, pathExists, readJson, writeJson } from "@/lib/fs-utils";
import type { ChangedFile, RepoRef, ReviewJob, ReviewRuntimeConfig } from "@/lib/types";

const JOB_FILE_NAME = "job.json";

function getJobDir(jobId: string) {
  return path.join(config.jobsRootDir, jobId);
}

function getJobFile(jobId: string) {
  return path.join(getJobDir(jobId), JOB_FILE_NAME);
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
  } satisfies ReviewJob;
}

export async function persistReviewJob(job: ReviewJob) {
  await ensureDir(getJobDir(job.id));
  await writeJson(getJobFile(job.id), job);
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
  const filePath = getJobFile(jobId);

  if (!(await pathExists(filePath))) {
    return null;
  }

  return readJson<ReviewJob>(filePath);
}

export async function updateReviewJob(jobId: string, updater: (job: ReviewJob) => ReviewJob | Promise<ReviewJob>) {
  const existingJob = await getReviewJob(jobId);

  if (!existingJob) {
    throw new Error(`Review job ${jobId} not found.`);
  }

  const nextJob = await updater(existingJob);
  nextJob.updatedAt = new Date().toISOString();
  await persistReviewJob(nextJob);

  return nextJob;
}

export async function appendJobLog(jobId: string, message: string) {
  return updateReviewJob(jobId, (job) => ({
    ...job,
    logs: [...job.logs, `[${new Date().toISOString()}] ${message}`],
  }));
}

export async function listReviewJobs() {
  await ensureDir(config.jobsRootDir);
  const jobIds = await listDirectories(config.jobsRootDir);
  const jobs = await Promise.all(jobIds.map((jobId) => getReviewJob(jobId)));

  return jobs
    .filter((job): job is ReviewJob => Boolean(job))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
