import { reviewBot } from "@/lib/review-bot";

export async function POST(request: Request) {
  return reviewBot.webhooks.telegram(request);
}
