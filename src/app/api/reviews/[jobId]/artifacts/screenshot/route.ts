import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadScreenshotArtifact } from "@/lib/blob";
import { createEmptyFeedbackState } from "@/lib/feedback-agent/contract";
import { pathExists } from "@/lib/fs-utils";
import { getReviewJob, updateReviewJob } from "@/lib/review-jobs-store";
import { parseTimestampToSeconds } from "@/lib/timestamps";
import { extractVideoScreenshot } from "@/lib/video";
import type { VideoArtifact } from "@/lib/types";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

const requestSchema = z.object({
  timestampText: z.string().optional(),
  timestampSeconds: z.number().int().nonnegative().optional(),
  findingId: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const body = requestSchema.parse(await request.json());
  const job = await getReviewJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Review job not found." }, { status: 404 });
  }

  const finalVideo = job.artifacts?.finalVideo ?? job.handoff?.stitchedVideo;

  if (!finalVideo) {
    return NextResponse.json({ error: "No stitched video artifact found for this review job." }, { status: 400 });
  }

  const timestampSeconds =
    body.timestampSeconds ?? (body.timestampText ? parseTimestampToSeconds(body.timestampText) : null);

  if (timestampSeconds === null) {
    return NextResponse.json({ error: "A timestamp is required." }, { status: 400 });
  }

  const screenshotName = `${body.findingId ?? "screenshot"}-${timestampSeconds}s`;
  const screenshotPath = path.join(job.outputDir, "screenshots", `${screenshotName}.png`);
  const videoSource = await resolveVideoSource(finalVideo, job.outputDir);

  if (!videoSource) {
    return NextResponse.json({ error: "The stitched video is not available for screenshot extraction." }, { status: 400 });
  }

  await extractVideoScreenshot({
    videoPathOrUrl: videoSource,
    outputPath: screenshotPath,
    timestampSeconds,
  });

  const screenshotArtifact =
    (await uploadScreenshotArtifact({
      filePath: screenshotPath,
      repoOwner: job.repo.owner,
      repoName: job.repo.name,
      prNumber: job.pr.number,
      jobId: job.id,
      screenshotName,
    })) ??
    ({
      kind: "local_path",
      location: screenshotPath,
      isDurable: false,
    } satisfies VideoArtifact);

  if (body.findingId) {
    await updateReviewJob(jobId, (current) => ({
      ...current,
      feedback: {
        ...(current.feedback ?? createEmptyFeedbackState()),
        findings: (current.feedback ?? createEmptyFeedbackState()).findings.map((finding) =>
          finding.id === body.findingId
            ? {
                ...finding,
                screenshotArtifact,
              }
            : finding,
        ),
      },
    }));
  }

  return NextResponse.json({
    timestampSeconds,
    screenshot: screenshotArtifact,
  });
}

async function resolveVideoSource(videoArtifact: VideoArtifact, outputDir: string) {
  if (videoArtifact.kind === "local_path") {
    return (await pathExists(videoArtifact.location)) ? videoArtifact.location : null;
  }

  const localFallback = path.join(outputDir, "final-review.mp4");
  if (await pathExists(localFallback)) {
    return localFallback;
  }

  return videoArtifact.location;
}
