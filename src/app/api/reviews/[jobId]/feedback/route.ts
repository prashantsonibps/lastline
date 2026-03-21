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
  try {
    const { jobId } = await context.params;
    const body = feedbackActionSchema.parse(await request.json());
    const job = await updateReviewJob(jobId, (current) => {
      const feedback = current.feedback ?? createEmptyFeedbackState();

      switch (body.action) {
        case "start_feedback":
          return {
            ...current,
            status: current.status === "video_ready" ? "awaiting_feedback" : current.status,
            feedback: {
              ...feedback,
              delivery: feedback.delivery ?? {
                deliveredAt: new Date().toISOString(),
                summary: "",
                videoUrl:
                  current.artifacts?.finalVideoUrl ??
                  current.handoff?.stitchedVideo?.location ??
                  "",
              },
              telegram: {
                ...feedback.telegram,
                chatId: body.telegramChatId,
                deliveryMessageId: body.telegramMessageId ?? feedback.telegram?.deliveryMessageId ?? "manual-feedback-start",
                threadId: feedback.telegram?.threadId,
                lastPromptMessageId: feedback.telegram?.lastPromptMessageId,
              },
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
          const createdIssue = feedback.findings.find((finding) => finding.id === body.findingId)?.issue;

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
              createdIssues:
                createdIssue && !feedback.createdIssues.some((issue) => issue.findingId === body.findingId)
                  ? [...feedback.createdIssues, createdIssue]
                  : feedback.createdIssues,
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
