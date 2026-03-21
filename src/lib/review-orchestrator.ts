import { config } from "@/lib/config";
import { startDevServer } from "@/lib/dev-server";
import { hasPotentialVisualChanges } from "@/lib/github";
import { runQaTask } from "@/lib/playwright-runner";
import { generateQaPlan } from "@/lib/qa-plan";
import { appendJobLog, getReviewJob, updateReviewJob } from "@/lib/review-jobs-store";
import { createIntroCard, stitchReviewVideo } from "@/lib/video";
import { prepareWorkspace } from "@/lib/workspace";
import type { ReviewArtifact } from "@/lib/types";

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
    status: "running",
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
    const workspace = await prepareWorkspace(job, log);

    const qaTasks = await generateQaPlan({
      repo: job.repo,
      pr: job.pr,
      changedFiles: job.changedFiles,
    });

    await updateReviewJob(jobId, (current) => ({
      ...current,
      tasks: qaTasks,
    }));

    serverHandle = await startDevServer({
      appDir: workspace.appDir,
      baseUrl: config.reviewAppBaseUrl,
      runtime: job.runtime,
      onLog: log,
    });

    const artifacts: ReviewArtifact[] = [];

    for (const task of qaTasks) {
      await log(`Running QA task ${task.id}: ${task.title}`);
      const artifact = await runQaTask({
        task,
        baseUrl: config.reviewAppBaseUrl,
        outputDir: job.outputDir,
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

    await updateReviewJob(jobId, (current) => ({
      ...current,
      status: "completed",
      artifacts: {
        taskArtifacts: artifacts,
        finalVideoPath,
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown review job failure.";

    await updateReviewJob(jobId, (current) => ({
      ...current,
      status: "failed",
      error: message,
    }));
    await log(`Job failed: ${message}`);
  } finally {
    await serverHandle?.stop();
  }
}
