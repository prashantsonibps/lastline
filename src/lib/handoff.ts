import type { ReviewJob } from "@/lib/types";

export function buildHandoffResponse(job: ReviewJob) {
  const stitchedVideo =
    job.handoff?.stitchedVideo ??
    job.artifacts?.finalVideo ??
    (job.artifacts?.finalVideoUrl
      ? {
          kind: job.artifacts.finalVideoUrl.startsWith("http") ? "remote_url" : "local_path",
          location: job.artifacts.finalVideoUrl,
          isDurable: job.artifacts.finalVideoUrl.startsWith("http"),
        }
      : undefined);

  return {
    id: job.id,
    status: job.status,
    repo: job.handoff?.repo ?? {
      owner: job.repo.owner,
      name: job.repo.name,
    },
    pr: job.handoff?.pr ?? {
      number: job.pr.number,
      title: job.pr.title,
      url: job.pr.url,
    },
    commitSha: job.handoff?.commitSha ?? job.pr.headSha,
    qaTaskSummaries: job.handoff?.qaTaskSummaries ?? [],
    stitchedVideo,
    feedback: job.feedback,
    error: job.error,
    updatedAt: job.updatedAt,
  };
}
