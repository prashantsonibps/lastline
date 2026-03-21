import { getReviewBot } from "@/lib/review-bot";

export async function POST(request: Request) {
  return getReviewBot().webhooks.telegram(request);
}
