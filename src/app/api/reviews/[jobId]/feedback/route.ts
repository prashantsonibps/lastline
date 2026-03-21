import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createEmptyFeedbackState } from "@/lib/feedback-agent/contract";
import { updateReviewJob } from "@/lib/review-jobs-store";
import { parseTimestampToSeconds } from "@/lib/timestamps";
import type { ReviewJobStatus } from "@/lib/types";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

const feedbackActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start_feedback"),
    telegramChatId: z.string().min(1),
    telegramMessageId: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("save_finding"),
    timestampText: z.string().min(1),
    note: z.string().min(1),
  }),
  z.object({
    action: z.literal("mark_issue_created"),
    findingId: z.string().min(1),
    issueUrl: z.string().url(),
  }),
  z.object({
    action: z.literal("set_status"),
    status: z.enum(["awaiting_feedback", "creating_issues", "done"] satisfies [ReviewJobStatus, ...ReviewJobStatus[]]),
  }),
]);

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const body = feedbackActionSchema.parse(await request.json());

  try {
    const job = await updateReviewJob(jobId, (current) => {
      const feedback = current.feedback ?? createEmptyFeedbackState();

      switch (body.action) {
        case "start_feedback":
          return {
            ...current,
            status: current.status === "video_ready" ? "awaiting_feedback" : current.status,
            feedback: {
              ...feedback,
              telegramChatId: body.telegramChatId,
              telegramMessageId: body.telegramMessageId,
              videoDeliveredAt: feedback.videoDeliveredAt ?? new Date().toISOString(),
            },
          };
        case "save_finding":
          return {
            ...current,
            status: current.status === "video_ready" ? "awaiting_feedback" : current.status,
            feedback: {
              ...feedback,
              findings: [
                ...feedback.findings,
                {
                  id: randomUUID(),
                  createdAt: new Date().toISOString(),
                  timestampInput: body.timestampText,
                  timestampText: body.timestampText,
                  timestampSeconds: parseTimestampToSeconds(body.timestampText),
                  description: body.note,
                  note: body.note,
                },
              ],
            },
          };
        case "mark_issue_created":
          return {
            ...current,
            feedback: {
              ...feedback,
              findings: feedback.findings.map((finding) =>
                finding.id === body.findingId
                  ? {
                      ...finding,
                      issueUrl: body.issueUrl,
                    }
                  : finding,
              ),
            },
          };
        case "set_status":
          return {
            ...current,
            status: body.status,
          };
      }
    });

    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update feedback state.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
