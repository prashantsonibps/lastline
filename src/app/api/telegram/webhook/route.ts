import { getReviewBot } from "@/lib/review-bot";
import { tryHandleTelegramTicTacToe, type TelegramUpdate } from "@/lib/telegram-tic-tac-toe";

export async function POST(request: Request) {
  const clonedRequest = request.clone();
  let body: TelegramUpdate | undefined;

  try {
    body = (await clonedRequest.json()) as TelegramUpdate;

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

  if (body) {
    const handled = await tryHandleTelegramTicTacToe(body);

    if (handled) {
      return Response.json({ ok: true, handled: "tic_tac_toe" });
    }
  }

  return getReviewBot().webhooks.telegram(request);
}
