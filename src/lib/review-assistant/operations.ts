import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { FileUpload } from "chat";
import { buildHandoffResponse } from "@/lib/handoff";
import { createGitHubIssuesAdapter, createIssueDraftingAdapter, createFfmpegScreenshotAdapter } from "@/lib/feedback-agent/adapters";
import { renderIssueBody } from "@/lib/feedback-agent/service";
import { normalizeTimestampToSeconds } from "@/lib/feedback-agent/timestamps";
import { getReviewJob, listReviewJobs, updateReviewJob } from "@/lib/review-jobs-store";
import type { CreatedIssueRef, FeedbackFinding, ReviewJob } from "@/lib/types";

function summarizeJob(job: ReviewJob) {
  return {
    id: job.id,
    repo: `${job.repo.owner}/${job.repo.name}`,
    prNumber: job.pr.number,
    prTitle: job.pr.title,
    status: job.status,
    updatedAt: job.updatedAt,
    tasks: job.tasks.map((task) => ({
      id: task.id,
      title: task.title,
    })),
    findings: job.feedback?.findings.length ?? 0,
    createdIssues: job.feedback?.createdIssues.length ?? 0,
    stitchedVideo:
      job.handoff?.stitchedVideo?.location ?? job.artifacts?.finalVideoUrl ?? job.artifacts?.finalVideo?.location,
  };
}

function assertJob(job: ReviewJob | null, jobId: string): ReviewJob {
  if (!job) {
    throw new Error(`Review job ${jobId} not found.`);
  }

  return job;
}

function assertVideoReadyJob(job: ReviewJob) {
  const videoLocation = job.artifacts?.finalVideoUrl ?? job.artifacts?.finalVideo?.location;

  if (!videoLocation) {
    throw new Error(`Review job ${job.id} does not have a stitched video artifact yet.`);
  }

  return job;
}

function buildFinding(timestampInput: string, description: string): FeedbackFinding {
  const timestampSeconds = normalizeTimestampToSeconds(timestampInput);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    timestampInput,
    timestampText: timestampInput,
    timestampSeconds,
    description,
    note: description,
  };
}

function applyScreenshot(run: ReviewJob, findingId: string, screenshot: NonNullable<FeedbackFinding["screenshot"]>) {
  return {
    ...run,
    feedback: {
      ...run.feedback!,
      screenshotsByTimestamp: {
        ...run.feedback!.screenshotsByTimestamp,
        [String(screenshot.timestampSeconds)]: screenshot,
      },
      findings: run.feedback!.findings.map((finding) =>
        finding.id === findingId
          ? {
              ...finding,
              screenshot,
            }
          : finding,
      ),
    },
  } satisfies ReviewJob;
}

export async function listReviewJobsOperation() {
  const jobs = await listReviewJobs();
  return {
    jobs: jobs.map(summarizeJob),
  };
}

export async function inspectReviewJobOperation(jobId: string) {
  const job = assertJob(await getReviewJob(jobId), jobId);
  return {
    ...summarizeJob(job),
    prUrl: job.pr.url,
    error: job.error ?? null,
    feedbackState: job.feedback?.conversation.step ?? "idle",
  };
}

export async function inspectReviewHandoffOperation(jobId: string) {
  const job = assertJob(await getReviewJob(jobId), jobId);
  return buildHandoffResponse(job);
}

export async function summarizeReviewStatusOperation(jobId: string) {
  const job = assertJob(await getReviewJob(jobId), jobId);
  return {
    id: job.id,
    status: job.status,
    findings: job.feedback?.findings.length ?? 0,
    createdIssues: job.feedback?.createdIssues.length ?? 0,
    activeConversationStep: job.feedback?.conversation.step ?? "idle",
    updatedAt: job.updatedAt,
  };
}

export async function saveReviewFindingOperation(input: {
  description: string;
  jobId: string;
  timestamp: string;
}) {
  const job = assertJob(await getReviewJob(input.jobId), input.jobId);
  assertVideoReadyJob(job);

  const finding = buildFinding(input.timestamp.trim(), input.description.trim());

  const updatedJob = await updateReviewJob(input.jobId, (current) => ({
    ...current,
    status: current.status === "video_ready" ? "awaiting_feedback" : current.status,
    feedback: {
      ...current.feedback!,
      conversation: { step: "idle" },
      findings: [...current.feedback!.findings, finding],
    },
  }));

  return {
    saved: true,
    job: summarizeJob(updatedJob),
    finding: {
      id: finding.id,
      timestamp: finding.timestampInput,
      timestampSeconds: finding.timestampSeconds,
      description: finding.description,
    },
  };
}

export async function createReviewIssuesOperation(input: { jobId: string }) {
  const screenshots = createFfmpegScreenshotAdapter();
  const issueDrafting = createIssueDraftingAdapter();
  const github = createGitHubIssuesAdapter();

  let run = assertJob(await getReviewJob(input.jobId), input.jobId);
  assertVideoReadyJob(run);

  if ((run.feedback?.findings.length ?? 0) === 0) {
    throw new Error(`Review job ${run.id} does not have any findings to convert into issues.`);
  }

  run = await updateReviewJob(run.id, (current) => ({
    ...current,
    status: "creating_issues",
  }));

  for (const finding of run.feedback!.findings) {
    const screenshotKey = String(finding.timestampSeconds);
    let screenshot = run.feedback!.screenshotsByTimestamp[screenshotKey];

    if (!screenshot) {
      screenshot = await screenshots.extractScreenshot({
        run,
        timestampSeconds: finding.timestampSeconds,
      });
      run = applyScreenshot(run, finding.id, screenshot);
    }

    const updatedFinding = run.feedback!.findings.find((entry) => entry.id === finding.id)!;
    const draft = await issueDrafting.draftIssue({
      run,
      finding: updatedFinding,
    });
    const issue = await github.createIssue({
      run,
      finding: updatedFinding,
      title: draft.title,
      body: renderIssueBody({
        run,
        finding: updatedFinding,
        draft,
      }),
    });

    const issueRef: CreatedIssueRef = {
      findingId: updatedFinding.id,
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      title: draft.title,
    };

    run = {
      ...run,
      feedback: {
        ...run.feedback!,
        findings: run.feedback!.findings.map((entry) =>
          entry.id === updatedFinding.id
            ? {
                ...entry,
                issue: issueRef,
                issueUrl: issue.issueUrl,
              }
            : entry,
        ),
        createdIssues: [...run.feedback!.createdIssues, issueRef],
      },
    };
  }

  const finalRun = await updateReviewJob(run.id, () => ({
    ...run,
    status: "done",
  }));

  return {
    job: summarizeJob(finalRun),
    createdIssues: finalRun.feedback!.createdIssues.map((issue) => ({
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      title: issue.title,
    })),
  };
}

export async function loadReviewVideoUpload(job: ReviewJob): Promise<FileUpload> {
  const localPath = job.artifacts?.finalVideoPath ?? job.artifacts?.finalVideo?.location;
  const filename = path.basename(localPath ?? "final-review.mp4");

  if (localPath && !localPath.startsWith("http")) {
    return {
      data: await readFile(localPath),
      filename,
      mimeType: "video/mp4",
    };
  }

  const remoteUrl = job.artifacts?.finalVideoUrl ?? job.handoff?.stitchedVideo?.location;

  if (!remoteUrl) {
    throw new Error(`Review job ${job.id} does not have a deliverable stitched video.`);
  }

  const response = await fetch(remoteUrl);

  if (!response.ok) {
    throw new Error(`Unable to download the stitched video for review job ${job.id}.`);
  }

  return {
    data: await response.arrayBuffer(),
    filename: path.basename(new URL(remoteUrl).pathname) || filename,
    mimeType: "video/mp4",
  };
}

export function buildReviewDeliverySummary(job: ReviewJob) {
  const taskLines =
    job.tasks.length > 0
      ? job.tasks.map((task, index) => `${index + 1}. ${task.title}`).join("\n")
      : "1. Review-ready handoff available";

  return [
    `PR Review Ready: #${job.pr.number} ${job.pr.title}`,
    `${job.repo.owner}/${job.repo.name}`,
    `PR: ${job.pr.url ?? "URL unavailable"}`,
    "",
    "What was tested:",
    taskLines,
    "",
    "Use the buttons below to report a bug or create issues after you finish reviewing.",
  ].join("\n");
}
