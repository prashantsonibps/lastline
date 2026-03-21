import { NextResponse } from "next/server";
import { createManualReviewJob } from "@/lib/review-jobs-store";
import { executeReviewJob } from "@/lib/review-orchestrator";
import { buildSpaceGuardManualRunInput } from "@/lib/spaceguard";

export const maxDuration = 300;

export async function POST() {
  const job = await createManualReviewJob(buildSpaceGuardManualRunInput());
  await executeReviewJob(job.id);

  return NextResponse.json({
    accepted: true,
    preset: "spaceguard",
    jobId: job.id,
  });
}
