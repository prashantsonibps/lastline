import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { createFeedbackAgent } from "@/lib/feedback-agent";
import { createDefaultFeedbackAgentDependencies } from "@/lib/feedback-agent/adapters";
import { listReviewJobs, updateReviewJob } from "@/lib/review-jobs-store";

const callbackSchema = z.object({
  callback_query: z.object({
    data: z.enum(["report_bug", "add_another", "create_issues"]),
    message: z.object({
      chat: z.object({
        id: z.union([z.string(), z.number()]),
      }),
    }),
  }),
});

const messageSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.union([z.string(), z.number()]),
    }),
    text: z.string().min(1),
  }),
});

async function findJobByChatId(chatId: string) {
  const jobs = await listReviewJobs();
  return jobs.find((job) => job.feedback?.telegram?.chatId === chatId && job.status === "awaiting_feedback") ?? null;
}

export async function POST(request: NextRequest) {
  if (config.telegramWebhookSecret) {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== config.telegramWebhookSecret) {
      return NextResponse.json({ error: "Invalid Telegram webhook secret." }, { status: 401 });
    }
  }

  const body = await request.json();
  const agent = createFeedbackAgent(createDefaultFeedbackAgentDependencies());

  const callbackParsed = callbackSchema.safeParse(body);
  if (callbackParsed.success) {
    const chatId = String(callbackParsed.data.callback_query.message.chat.id);
    const job = await findJobByChatId(chatId);

    if (!job) {
      return NextResponse.json({ ignored: true }, { status: 202 });
    }

    const updated = await agent.handleTelegramEvent({
      run: job,
      event: {
        type: "callback",
        chatId,
        action: callbackParsed.data.callback_query.data,
      },
    });
    await updateReviewJob(job.id, () => updated);
    return NextResponse.json({ ok: true });
  }

  const messageParsed = messageSchema.safeParse(body);
  if (messageParsed.success) {
    const chatId = String(messageParsed.data.message.chat.id);
    const job = await findJobByChatId(chatId);

    if (!job) {
      return NextResponse.json({ ignored: true }, { status: 202 });
    }

    const updated = await agent.handleTelegramEvent({
      run: job,
      event: {
        type: "message",
        chatId,
        text: messageParsed.data.message.text,
      },
    });
    await updateReviewJob(job.id, () => updated);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ignored: true }, { status: 202 });
}
