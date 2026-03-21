import { InferAgentUIMessage, ToolLoopAgent, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/ai-model";
import { config } from "@/lib/config";
import { createReviewAssistantTools, type ReviewAssistantContext } from "@/lib/review-assistant/tools";

function buildInstructions(context: ReviewAssistantContext) {
  const contextLines = [
    "You are Lastline, the review operations assistant for a Vercel hackathon project.",
    "You help operators inspect review jobs, trigger Telegram delivery, save findings, and create GitHub issues.",
    "Be concise, operational, and accurate.",
    "Never invent job ids, timestamps, issue URLs, or review status; use tools whenever concrete data is needed.",
    "When a user asks about a specific review run, inspect it before answering.",
    "When a user asks you to save a finding or create issues, prefer the dedicated tool instead of describing the steps.",
  ];

  if (context.activeJobId) {
    contextLines.push(`The currently active review job is ${context.activeJobId}. Use it by default unless the user picks another job.`);
  }

  if (context.surface === "telegram") {
    contextLines.push("You are responding inside Telegram, so keep replies short and action-oriented.");
  } else {
    contextLines.push("You are responding inside the browser control chat, so you can be slightly more descriptive.");
  }

  return contextLines.join(" ");
}

export function createReviewAssistant(context: ReviewAssistantContext) {
  return new ToolLoopAgent({
    model: getLanguageModel(config.reviewAssistantModel),
    instructions: buildInstructions(context),
    stopWhen: stepCountIs(8),
    tools: createReviewAssistantTools(context),
  });
}

export type ReviewAssistantUIMessage = InferAgentUIMessage<ReturnType<typeof createReviewAssistant>>;
