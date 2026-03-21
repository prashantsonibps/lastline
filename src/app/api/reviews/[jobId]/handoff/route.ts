import { NextRequest, NextResponse } from "next/server";
import { buildHandoffResponse } from "@/lib/handoff";
import { getReviewJob } from "@/lib/review-jobs-store";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const job = await getReviewJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Review job not found." }, { status: 404 });
  }

  return NextResponse.json(buildHandoffResponse(job));
}
