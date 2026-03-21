import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getReviewJob, updateReviewJob } from "@/lib/review-jobs-store";
import { deliverReviewToTelegram } from "@/lib/review-bot";

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
  try {
    const { jobId } = await context.params;
    const job = await getReviewJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Review job not found." }, { status: 404 });
    }

    const body = startFeedbackSchema.parse(await request.json().catch(() => ({})));
    const chatId = body.chatId ?? job.feedback?.telegram?.chatId;

    if (!chatId) {
      return NextResponse.json({ error: "Telegram chat id is required." }, { status: 400 });
    }

    const result = await deliverReviewToTelegram({
      jobId,
      chatId,
      threadId: body.threadId,
    });
    await updateReviewJob(jobId, (current) => ({
      ...current,
      feedback: {
        ...current.feedback!,
        telegram: {
          ...current.feedback?.telegram,
          chatId,
          threadId: body.threadId,
          deliveryMessageId: result.deliveryMessageId,
        },
      },
    }));

    return NextResponse.json({
      ok: true,
      status: result.job.status,
      threadId: result.threadId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start feedback delivery.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
