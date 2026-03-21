import {
  applyMove,
  clearTicTacToeState,
  createNewTicTacToeState,
  getTicTacToeState,
  getWinnerAnnouncement,
  isTicTacToeStartMessage,
  parseTicTacToeCellActionId,
  resolveBotTurn,
  setTicTacToeState,
  TICTACTOE_PLAY_AGAIN_ACTION_ID,
  TICTACTOE_RESET_ACTION_ID,
  type TicTacToeState,
} from "@/lib/tic-tac-toe";
import { config } from "@/lib/config";

type TelegramChat = {
  id: number | string;
  type?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  message_thread_id?: number;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate =
  | {
      update_id?: number;
      message?: TelegramMessage;
      callback_query?: undefined;
    }
  | {
      update_id?: number;
      message?: undefined;
      callback_query?: TelegramCallbackQuery;
    };

function createThreadId(chatId: string | number, threadId?: number) {
  return threadId ? `telegram:${chatId}:${threadId}` : `telegram:${chatId}`;
}

function renderBoardText(state: TicTacToeState, message: string) {
  const cells = state.board.map((cell) => cell ?? " ");
  const rows = [
    ` ${cells[0]} | ${cells[1]} | ${cells[2]} `,
    ` ${cells[3]} | ${cells[4]} | ${cells[5]} `,
    ` ${cells[6]} | ${cells[7]} | ${cells[8]} `,
  ];

  return [
    "Lastline Tic Tac Toe",
    "",
    message,
    getWinnerAnnouncement(state.winner),
    "",
    rows[0],
    "---+---+---",
    rows[1],
    "---+---+---",
    rows[2],
  ].join("\n");
}

function createBoardMarkup(state: TicTacToeState) {
  const inline_keyboard = [
    [0, 1, 2].map((index) => ({
      text: state.board[index] ?? " ",
      callback_data: `ttt_cell_${index}`,
    })),
    [3, 4, 5].map((index) => ({
      text: state.board[index] ?? " ",
      callback_data: `ttt_cell_${index}`,
    })),
    [6, 7, 8].map((index) => ({
      text: state.board[index] ?? " ",
      callback_data: `ttt_cell_${index}`,
    })),
    [
      { text: "Play again", callback_data: TICTACTOE_PLAY_AGAIN_ACTION_ID },
      { text: "Reset", callback_data: TICTACTOE_RESET_ACTION_ID },
    ],
  ];

  return { inline_keyboard };
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for Telegram bot actions.");
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: Record<string, unknown>;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.description
        ? `Telegram API returned ${response.status} for ${method}: ${payload.description}`
        : `Telegram API returned ${response.status} for ${method}.`,
    );
  }

  return payload.result ?? {};
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

async function sendBoardMessage(input: {
  chatId: string | number;
  threadId?: number;
  state: TicTacToeState;
  message: string;
}) {
  const result = await telegramApi("sendMessage", {
    chat_id: input.chatId,
    message_thread_id: input.threadId,
    text: renderBoardText(input.state, input.message),
    reply_markup: createBoardMarkup(input.state),
  });

  return Number(result.message_id);
}

async function editBoardMessage(input: {
  chatId: string | number;
  messageId: number;
  state: TicTacToeState;
  message: string;
}) {
  await telegramApi("editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: renderBoardText(input.state, input.message),
    reply_markup: createBoardMarkup(input.state),
  });
}

async function upsertBoardMessage(input: {
  chatId: string | number;
  threadId?: number;
  messageId?: number | null;
  state: TicTacToeState;
  message: string;
}) {
  if (input.messageId) {
    try {
      await editBoardMessage({
        chatId: input.chatId,
        messageId: input.messageId,
        state: input.state,
        message: input.message,
      });
      return input.messageId;
    } catch (error) {
      console.warn("[telegram:tictactoe] edit failed, sending fresh board", {
        chatId: input.chatId,
        messageId: input.messageId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return sendBoardMessage({
    chatId: input.chatId,
    threadId: input.threadId,
    state: input.state,
    message: input.message,
  });
}

async function sendPlainMessage(chatId: string | number, threadId: number | undefined, text: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    message_thread_id: threadId,
    text,
  });
}

export async function tryHandleTelegramTicTacToe(update: TelegramUpdate) {
  if (update.message?.text) {
    const text = update.message.text.trim();

    if (!isTicTacToeStartMessage(text)) {
      return false;
    }

    const threadId = createThreadId(update.message.chat.id, update.message.message_thread_id);
    const existingState = await getTicTacToeState(threadId);

    if (existingState?.status === "active" && existingState.lastBoardMessageId) {
      const boardMessageId = await upsertBoardMessage({
        chatId: update.message.chat.id,
        threadId: update.message.message_thread_id,
        messageId: Number(existingState.lastBoardMessageId),
        state: existingState,
        message: "Game already in progress. You are X and I am O.",
      });
      await setTicTacToeState(threadId, {
        ...existingState,
        lastBoardMessageId: String(boardMessageId),
      });
      return true;
    }

    const state = createNewTicTacToeState();
    const boardMessageId = await sendBoardMessage({
      chatId: update.message.chat.id,
      threadId: update.message.message_thread_id,
      state,
      message: "You said you were bored, so I brought a board. You go first as X.",
    });

    await setTicTacToeState(threadId, {
      ...state,
      lastBoardMessageId: String(boardMessageId),
    });

    return true;
  }

  const callback = update.callback_query;

  if (!callback?.data || !callback.message) {
    return false;
  }

  if (
    callback.data !== TICTACTOE_PLAY_AGAIN_ACTION_ID &&
    callback.data !== TICTACTOE_RESET_ACTION_ID &&
    parseTicTacToeCellActionId(callback.data) === null
  ) {
    return false;
  }

  const threadId = createThreadId(callback.message.chat.id, callback.message.message_thread_id);

  if (callback.data === TICTACTOE_RESET_ACTION_ID) {
    await clearTicTacToeState(threadId);
    await answerCallbackQuery(callback.id, "Game reset");
    await sendPlainMessage(
      callback.message.chat.id,
      callback.message.message_thread_id,
      "Tic Tac Toe reset. Say `bored` or `/tictactoe` when you want another round.",
    );
    return true;
  }

  if (callback.data === TICTACTOE_PLAY_AGAIN_ACTION_ID) {
    const state = createNewTicTacToeState();
    const boardMessageId = await upsertBoardMessage({
      chatId: callback.message.chat.id,
      threadId: callback.message.message_thread_id,
      messageId: callback.message.message_id,
      state,
      message: "Fresh board. You are X again.",
    });
    await setTicTacToeState(threadId, {
      ...state,
      lastBoardMessageId: String(boardMessageId),
    });
    await answerCallbackQuery(callback.id, "Fresh board");
    return true;
  }

  const cellIndex = parseTicTacToeCellActionId(callback.data);

  if (cellIndex === null) {
    return false;
  }

  const currentState = await getTicTacToeState(threadId);

  if (!currentState) {
    await answerCallbackQuery(callback.id, "Start a game first");
    await sendPlainMessage(
      callback.message.chat.id,
      callback.message.message_thread_id,
      "No active Tic Tac Toe game yet. Say `bored` or `/tictactoe` to start one.",
    );
    return true;
  }

  let afterHumanMove: TicTacToeState;
  try {
    afterHumanMove = applyMove(currentState, cellIndex, "X");
  } catch (error) {
    await answerCallbackQuery(callback.id, error instanceof Error ? error.message : "That move did not work.");
    return true;
  }

  if (afterHumanMove.status === "finished") {
    const finalState = {
      ...afterHumanMove,
    };
    const boardMessageId = await upsertBoardMessage({
      chatId: callback.message.chat.id,
      threadId: callback.message.message_thread_id,
      messageId: Number(currentState.lastBoardMessageId ?? callback.message.message_id),
      state: finalState,
      message: "You locked in your move.",
    });
    await setTicTacToeState(threadId, finalState);
    await setTicTacToeState(threadId, {
      ...finalState,
      lastBoardMessageId: String(boardMessageId),
    });
    await answerCallbackQuery(callback.id, "Move saved");
    return true;
  }

  const botTurn = await resolveBotTurn(afterHumanMove.board);
  let finalState = afterHumanMove;

  if (typeof botTurn.move === "number") {
    try {
      finalState = applyMove(afterHumanMove, botTurn.move, "O");
    } catch {
      finalState = afterHumanMove;
    }
  }

  finalState = {
    ...finalState,
    lastCommentary: botTurn.quip ?? null,
  };

  const boardMessageId = await upsertBoardMessage({
    chatId: callback.message.chat.id,
    threadId: callback.message.message_thread_id,
    messageId: Number(currentState.lastBoardMessageId ?? callback.message.message_id),
    state: finalState,
    message: botTurn.quip?.trim() || "I made my move.",
  });
  await setTicTacToeState(threadId, {
    ...finalState,
    lastBoardMessageId: String(boardMessageId),
  });
  await answerCallbackQuery(callback.id, "Move saved");
  return true;
}
