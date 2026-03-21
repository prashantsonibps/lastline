import { createAgentUIStreamResponse } from "ai";
import { createReviewAssistant } from "@/lib/review-assistant/agent";

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: createReviewAssistant({
      surface: "web",
    }),
    uiMessages: messages,
  });
}
