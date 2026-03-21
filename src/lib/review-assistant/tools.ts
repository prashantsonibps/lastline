import { tool } from "ai";
import { z } from "zod";
import {
  createReviewIssuesOperation,
  inspectReviewHandoffOperation,
  inspectReviewJobOperation,
  listReviewJobsOperation,
  saveReviewFindingOperation,
  summarizeReviewStatusOperation,
} from "@/lib/review-assistant/operations";
import { deliverReviewToTelegram } from "@/lib/review-bot";

export type ReviewAssistantContext = {
  activeJobId?: string;
  surface: "telegram" | "web";
  telegramChatId?: string;
  telegramThreadId?: string;
};

function resolveJobId(context: ReviewAssistantContext, inputJobId?: string) {
  const jobId = inputJobId ?? context.activeJobId;

  if (!jobId) {
    throw new Error("A review job id is required. List jobs first and then provide the id you want to use.");
  }

  return jobId;
}

export function createReviewAssistantTools(context: ReviewAssistantContext) {
  return {
    listReviewJobs: tool({
      description: "List the most recent review jobs and their statuses.",
      inputSchema: z.object({}),
      execute: async () => listReviewJobsOperation(),
    }),
    inspectReviewJob: tool({
      description: "Inspect a specific review job in detail.",
      inputSchema: z.object({
        jobId: z.string().min(1).describe("The review job id to inspect."),
      }),
      execute: async ({ jobId }) => inspectReviewJobOperation(jobId),
    }),
    inspectReviewHandoff: tool({
      description: "Inspect the stable video_ready handoff payload for a review job.",
      inputSchema: z.object({
        jobId: z.string().optional().describe("The review job id. Uses the active job when omitted."),
      }),
      execute: async ({ jobId }) => inspectReviewHandoffOperation(resolveJobId(context, jobId)),
    }),
    startTelegramFeedback: tool({
      description: "Send the stitched review video and feedback controls into Telegram for a review job.",
      inputSchema: z.object({
        jobId: z.string().optional().describe("The review job id. Uses the active job when omitted."),
        chatId: z.string().optional().describe("Telegram chat id. Optional if already configured."),
        threadId: z.string().optional().describe("Telegram topic/thread id when posting into a forum topic."),
      }),
      execute: async ({ jobId, chatId, threadId }) =>
        deliverReviewToTelegram({
          jobId: resolveJobId(context, jobId),
          chatId: chatId ?? context.telegramChatId,
          threadId: threadId ?? context.telegramThreadId,
        }),
    }),
    saveReviewFinding: tool({
      description: "Save a timestamped review finding onto a review job.",
      inputSchema: z.object({
        jobId: z.string().optional().describe("The review job id. Uses the active job when omitted."),
        timestamp: z.string().min(1).describe("The timestamp, such as 75, 1:15, or 00:01:15."),
        description: z.string().min(1).describe("The bug or issue description to save."),
      }),
      execute: async ({ jobId, timestamp, description }) =>
        saveReviewFindingOperation({
          jobId: resolveJobId(context, jobId),
          timestamp,
          description,
        }),
    }),
    createReviewIssues: tool({
      description: "Create GitHub issues from all saved findings on a review job.",
      inputSchema: z.object({
        jobId: z.string().optional().describe("The review job id. Uses the active job when omitted."),
      }),
      execute: async ({ jobId }) => createReviewIssuesOperation({ jobId: resolveJobId(context, jobId) }),
    }),
    summarizeReviewStatus: tool({
      description: "Summarize the current state of a review job.",
      inputSchema: z.object({
        jobId: z.string().optional().describe("The review job id. Uses the active job when omitted."),
      }),
      execute: async ({ jobId }) => summarizeReviewStatusOperation(resolveJobId(context, jobId)),
    }),
  };
}
