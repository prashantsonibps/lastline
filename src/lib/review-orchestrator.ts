import { config } from "@/lib/config";
import { startDevServer } from "@/lib/dev-server";
import { uploadFinalVideoArtifact } from "@/lib/blob";
import { hasPotentialVisualChanges } from "@/lib/github";
import { runQaTask } from "@/lib/playwright-runner";
import { generateQaPlan } from "@/lib/qa-plan";
import { appendJobLog, getReviewJob, updateReviewJob } from "@/lib/review-jobs-store";
import { createIntroCard, stitchReviewVideo } from "@/lib/video";
import { prepareWorkspace } from "@/lib/workspace";
import type { QaTask, ReviewArtifact, VideoArtifact } from "@/lib/types";

function buildTaskSummaries(tasks: QaTask[]) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    goal: task.goal,
    steps: task.steps,
    expected: task.expected,
  }));
}

function createLocalVideoArtifact(location: string): VideoArtifact {
  return {
    kind: "local_path",
    location,
    isDurable: false,
  };
}

function isLiveReviewRun(job: {
  runtime: {
    reviewBaseUrl?: string;
    skipInstall?: boolean;
    skipAppStart?: boolean;
  };
}) {
  return Boolean(job.runtime.reviewBaseUrl && job.runtime.skipInstall && job.runtime.skipAppStart);
}

export async function executeReviewJob(jobId: string) {
  const existingJob = await getReviewJob(jobId);

  if (!existingJob) {
    throw new Error(`Review job ${jobId} not found.`);
  }

  const changedFiles = existingJob.changedFiles.map((file) => file.filename);
  if (changedFiles.length > 0 && !hasPotentialVisualChanges(changedFiles)) {
    await updateReviewJob(jobId, (job) => ({
      ...job,
      status: "ignored",
      error: "No likely visual changes were detected in this pull request.",
    }));
    return;
  }

  await updateReviewJob(jobId, (job) => ({
    ...job,
    status: "planning",
    error: undefined,
  }));

  const log = async (message: string) => {
    if (message.length > 0) {
      await appendJobLog(jobId, message);
    }
  };

  let serverHandle: Awaited<ReturnType<typeof startDevServer>> | undefined;

  try {
    const job = (await getReviewJob(jobId))!;
    const reviewBaseUrl = job.runtime.reviewBaseUrl ?? config.reviewAppBaseUrl;
    const shouldPrepareWorkspace = !isLiveReviewRun(job);
    const workspace = shouldPrepareWorkspace ? await prepareWorkspace(job, log) : null;

    if (!shouldPrepareWorkspace) {
      await log(`Skipping workspace clone and dependency preparation; using live review target ${reviewBaseUrl}`);
    }

    const qaTasks = await generateQaPlan({
      repo: job.repo,
      pr: job.pr,
      changedFiles: job.changedFiles,
    });

    await updateReviewJob(jobId, (current) => ({
      ...current,
      status: "testing",
      tasks: qaTasks,
    }));

    if (job.runtime.skipAppStart) {
      await log(`Skipping local app start and using review base URL ${reviewBaseUrl}`);
    } else {
      if (!workspace) {
        throw new Error("A local workspace is required when runtime.skipAppStart is disabled.");
      }

      serverHandle = await startDevServer({
        appDir: workspace.appDir,
        baseUrl: reviewBaseUrl,
        runtime: job.runtime,
        onLog: log,
      });
    }

    const artifacts: ReviewArtifact[] = [];

    for (const task of qaTasks) {
      await log(`Running QA task ${task.id}: ${task.title}`);
      const artifact = await runQaTask({
        task,
        baseUrl: reviewBaseUrl,
        outputDir: job.outputDir,
        onLog: log,
      });
      await createIntroCard({
        task,
        artifact,
        onLog: log,
      });
      artifacts.push(artifact);
    }

    const finalVideoPath = await stitchReviewVideo({
      artifacts,
      outputDir: job.outputDir,
      onLog: log,
    });
    const uploadedFinalVideo =
      (await uploadFinalVideoArtifact({
        filePath: finalVideoPath,
        repoOwner: job.repo.owner,
        repoName: job.repo.name,
        prNumber: job.pr.number,
        jobId: job.id,
      })) ?? createLocalVideoArtifact(finalVideoPath);

    if (uploadedFinalVideo.kind === "remote_url") {
      await log(`Uploaded stitched video to ${uploadedFinalVideo.location}`);
    } else {
      await log("Blob upload not configured; keeping stitched video as a local artifact path");
    }

    const derivedPrUrl = job.pr.url ?? `https://github.com/${job.repo.owner}/${job.repo.name}/pull/${job.pr.number}`;
    const finalVideoUrl = uploadedFinalVideo.location;

    await updateReviewJob(jobId, (current) => ({
      ...current,
      status: "video_ready",
      artifacts: {
        taskArtifacts: artifacts,
        finalVideoPath,
        finalVideoUrl,
        finalVideo: uploadedFinalVideo,
      },
      pr: {
        ...current.pr,
        url: current.pr.url ?? derivedPrUrl,
      },
      feedback: current.feedback ?? {
        conversation: { step: "idle" },
        findings: [],
        screenshotsByTimestamp: {},
        createdIssues: [],
      },
      handoff: {
        repo: {
          owner: current.repo.owner,
          name: current.repo.name,
        },
        pr: {
          number: current.pr.number,
          title: current.pr.title,
          url: current.pr.url ?? derivedPrUrl,
        },
        commitSha: current.pr.headSha,
        qaTaskSummaries: buildTaskSummaries(current.tasks),
        stitchedVideo: uploadedFinalVideo,
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown review job failure.";
    const failureLogLine = `[${new Date().toISOString()}] Job failed: ${message}`;

    await updateReviewJob(jobId, (current) => ({
      ...current,
      status: "failed",
      error: message,
      logs: [...current.logs, failureLogLine],
    }));
  } finally {
    await serverHandle?.stop();
  }
}
