import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFeedbackAgent } from "@/lib/feedback-agent";
import { createDefaultFeedbackAgentDependencies, resolveTelegramChatId } from "@/lib/feedback-agent/adapters";
import { getReviewJob, updateReviewJob } from "@/lib/review-jobs-store";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

const startFeedbackSchema = z.object({
  chatId: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const job = await getReviewJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Review job not found." }, { status: 404 });
  }

  const body = startFeedbackSchema.parse(await request.json().catch(() => ({})));
  const chatId = body.chatId ?? resolveTelegramChatId(job);

  if (!chatId) {
    return NextResponse.json({ error: "Telegram chat id is required." }, { status: 400 });
  }

  const agent = createFeedbackAgent(createDefaultFeedbackAgentDependencies());
  const updatedJob = await agent.startFeedbackForRun({
    run: job,
    chatId,
    threadId: body.threadId,
  });

  await updateReviewJob(jobId, () => updatedJob);

  return NextResponse.json({
    ok: true,
    status: updatedJob.status,
  });
}
