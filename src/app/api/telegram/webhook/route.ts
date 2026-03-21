import { getReviewBot } from "@/lib/review-bot";

export async function POST(request: Request) {
  const clonedRequest = request.clone();

  try {
    const body = (await clonedRequest.json()) as {
      update_id?: number;
      message?: {
        text?: string;
        chat?: { id?: number | string; type?: string };
      };
      callback_query?: {
        data?: string;
        message?: {
          chat?: { id?: number | string; type?: string };
        };
      };
    };

    console.log("[telegram:webhook] incoming update", {
      updateId: body.update_id,
      text: body.message?.text,
      chatId: body.message?.chat?.id ?? body.callback_query?.message?.chat?.id,
      chatType: body.message?.chat?.type,
      callbackData: body.callback_query?.data,
    });
  } catch (error) {
    console.warn("[telegram:webhook] failed to parse request body for logging", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return getReviewBot().webhooks.telegram(request);
}
