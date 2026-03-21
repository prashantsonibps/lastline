import type { ReviewJob } from "@/lib/types";

export function buildHandoffResponse(job: ReviewJob) {
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
    stitchedVideo: job.handoff?.stitchedVideo,
    feedback: job.feedback,
    error: job.error,
    updatedAt: job.updatedAt,
  };
}

