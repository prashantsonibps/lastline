import { ReviewChat } from "@/components/review-chat";
import { listReviewJobs } from "@/lib/review-jobs-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await listReviewJobs();

  return (
    <ReviewChat
      initialJobs={jobs.map((job) => ({
        id: job.id,
        repo: `${job.repo.owner}/${job.repo.name}`,
        prNumber: job.pr.number,
        prTitle: job.pr.title,
        status: job.status,
        updatedAt: job.updatedAt,
        stitchedVideo: job.handoff?.stitchedVideo?.location,
      }))}
    />
  );
}
