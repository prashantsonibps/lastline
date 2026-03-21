import { NextRequest, NextResponse } from "next/server";
import {
  createJobFromPullRequestEvent,
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/github";
import { executeReviewJob } from "@/lib/review-orchestrator";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
  }

  const eventName = request.headers.get("x-github-event");
  const event = parseWebhookEvent(eventName, rawBody);

  if (!event) {
    return NextResponse.json({ ignored: true }, { status: 202 });
  }

  const job = await createJobFromPullRequestEvent(event);
  void executeReviewJob(job.id);

  return NextResponse.json({
    accepted: true,
    jobId: job.id,
  });
}

