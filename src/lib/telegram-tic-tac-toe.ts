import {
  evaluateBoard,
  getFallbackMove,
  getWinnerAnnouncement,
  isTicTacToeStartMessage,
  resolveBotTurn,
  TICTACTOE_PLAY_AGAIN_ACTION_ID,
  TICTACTOE_RESET_ACTION_ID,
  type TicTacToeCell,
  type TicTacToeState,
  type TicTacToeWinner,
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

const EMPTY_BOARD = ".........";
const CELL_PREFIX = "ttt:";

function encodeBoard(board: TicTacToeCell[]) {
  return board.map((cell) => cell ?? ".").join("");
}

function decodeBoard(encoded: string): TicTacToeCell[] {
  return encoded.split("").map((cell) => {
    if (cell === "X" || cell === "O") {
      return cell;
    }

    return null;
  });
}

function toState(board: TicTacToeCell[]): TicTacToeState {
  const winner = evaluateBoard(board);
  const hasOpenCell = board.some((cell) => cell === null);
  const xCount = board.filter((cell) => cell === "X").length;
  const oCount = board.filter((cell) => cell === "O").length;

  return {
    status: winner || !hasOpenCell ? "finished" : "active",
    board,
    currentTurn: xCount === oCount ? "X" : "O",
    winner,
    lastBoardMessageId: null,
    lastCommentary: null,
  };
}

function createThreadId(chatId: string | number, threadId?: number) {
  return threadId ? `telegram:${chatId}:${threadId}` : `telegram:${chatId}`;
}

function createCellCallbackData(board: TicTacToeCell[], index: number) {
  return `${CELL_PREFIX}${encodeBoard(board)}:${index}`;
}

function parseCellCallbackData(data: string) {
  const match = data.match(/^ttt:([XO.]{9}):([0-8])$/);

  if (!match) {
    return null;
  }

  return {
    board: decodeBoard(match[1]),
    index: Number(match[2]),
  };
}

function parseLegacyCellCallbackData(data: string) {
  const match = data.match(/^ttt_cell_(\d)$/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function applyMoveToBoard(board: TicTacToeCell[], index: number, player: "X" | "O") {
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    throw new Error("That move is outside the board.");
  }

  if (evaluateBoard(board)) {
    throw new Error("The current game is already finished. Tap Play again to start a new round.");
  }

  if (board[index] !== null) {
    throw new Error("That square is already taken. Pick another one.");
  }

  const next = [...board];
  next[index] = player;
  return next;
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

function createBoardMarkup(board: TicTacToeCell[], winner: TicTacToeWinner) {
  const isFinished = Boolean(winner) || board.every((cell) => cell !== null);

  const inline_keyboard = [
    [0, 1, 2].map((index) => ({
      text: board[index] ?? " ",
      callback_data: isFinished ? TICTACTOE_PLAY_AGAIN_ACTION_ID : createCellCallbackData(board, index),
    })),
    [3, 4, 5].map((index) => ({
      text: board[index] ?? " ",
      callback_data: isFinished ? TICTACTOE_PLAY_AGAIN_ACTION_ID : createCellCallbackData(board, index),
    })),
    [6, 7, 8].map((index) => ({
      text: board[index] ?? " ",
      callback_data: isFinished ? TICTACTOE_PLAY_AGAIN_ACTION_ID : createCellCallbackData(board, index),
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
  board: TicTacToeCell[];
  message: string;
}) {
  const state = toState(input.board);
  await telegramApi("sendMessage", {
    chat_id: input.chatId,
    message_thread_id: input.threadId,
    text: renderBoardText(state, input.message),
    reply_markup: createBoardMarkup(input.board, state.winner),
  });
}

async function editBoardMessage(input: {
  chatId: string | number;
  messageId: number;
  board: TicTacToeCell[];
  message: string;
}) {
  const state = toState(input.board);
  await telegramApi("editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: renderBoardText(state, input.message),
    reply_markup: createBoardMarkup(input.board, state.winner),
  });
}

async function sendPlainMessage(chatId: string | number, threadId: number | undefined, text: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    message_thread_id: threadId,
    text,
  });
}

async function safeEditOrSendBoard(input: {
  chatId: string | number;
  threadId?: number;
  messageId: number;
  board: TicTacToeCell[];
  message: string;
}) {
  try {
    await editBoardMessage({
      chatId: input.chatId,
      messageId: input.messageId,
      board: input.board,
      message: input.message,
    });
  } catch (error) {
    console.warn("[telegram:tictactoe] edit failed, sending fresh board", {
      chatId: input.chatId,
      messageId: input.messageId,
      error: error instanceof Error ? error.message : "unknown",
    });
    await sendBoardMessage({
      chatId: input.chatId,
      threadId: input.threadId,
      board: input.board,
      message: input.message,
    });
  }
}

export async function tryHandleTelegramTicTacToe(update: TelegramUpdate) {
  if (update.message?.text) {
    const text = update.message.text.trim();

    if (!isTicTacToeStartMessage(text)) {
      return false;
    }

    console.log("[telegram:tictactoe] start", {
      threadId: createThreadId(update.message.chat.id, update.message.message_thread_id),
      text,
    });

    await sendBoardMessage({
      chatId: update.message.chat.id,
      threadId: update.message.message_thread_id,
      board: decodeBoard(EMPTY_BOARD),
      message: "You said you were bored, so I brought a board. You go first as X.",
    });

    return true;
  }

  const callback = update.callback_query;

  if (!callback?.data || !callback.message) {
    return false;
  }

  const legacyCellIndex = parseLegacyCellCallbackData(callback.data);

  if (
    callback.data !== TICTACTOE_PLAY_AGAIN_ACTION_ID &&
    callback.data !== TICTACTOE_RESET_ACTION_ID &&
    legacyCellIndex === null &&
    !callback.data.startsWith(CELL_PREFIX)
  ) {
    return false;
  }

  if (callback.data === TICTACTOE_RESET_ACTION_ID) {
    await answerCallbackQuery(callback.id, "Game reset");
    await sendPlainMessage(
      callback.message.chat.id,
      callback.message.message_thread_id,
      "Tic Tac Toe reset. Say `bored` or `/tictactoe` when you want another round.",
    );
    return true;
  }

  if (callback.data === TICTACTOE_PLAY_AGAIN_ACTION_ID) {
    await safeEditOrSendBoard({
      chatId: callback.message.chat.id,
      threadId: callback.message.message_thread_id,
      messageId: callback.message.message_id,
      board: decodeBoard(EMPTY_BOARD),
      message: "Fresh board. You are X again.",
    });
    await answerCallbackQuery(callback.id, "Fresh board");
    return true;
  }

  const parsed = parseCellCallbackData(callback.data);

  if (!parsed) {
    if (legacyCellIndex !== null) {
      await answerCallbackQuery(callback.id, "That board expired. Send bored to start a fresh round.");
      await sendPlainMessage(
        callback.message.chat.id,
        callback.message.message_thread_id,
        "That Tic Tac Toe board expired after the latest deploy. Say `bored` or `/tictactoe` to get a fresh board.",
      );
      return true;
    }

    return false;
  }

  let board: TicTacToeCell[];
  try {
    board = applyMoveToBoard(parsed.board, parsed.index, "X");
  } catch (error) {
    await answerCallbackQuery(callback.id, error instanceof Error ? error.message : "That move did not work.");
    return true;
  }

  const winnerAfterHuman = evaluateBoard(board);
  if (winnerAfterHuman || board.every((cell) => cell !== null)) {
    await safeEditOrSendBoard({
      chatId: callback.message.chat.id,
      threadId: callback.message.message_thread_id,
      messageId: callback.message.message_id,
      board,
      message: "You locked in your move.",
    });
    await answerCallbackQuery(callback.id, "Move saved");
    return true;
  }

  const botTurn = await resolveBotTurn(board);
  if (typeof botTurn.move === "number") {
    try {
      board = applyMoveToBoard(board, botTurn.move, "O");
    } catch {
      const fallbackMove = getFallbackMove(board);
      if (typeof fallbackMove === "number") {
        board = applyMoveToBoard(board, fallbackMove, "O");
      }
    }
  }

  await safeEditOrSendBoard({
    chatId: callback.message.chat.id,
    threadId: callback.message.message_thread_id,
    messageId: callback.message.message_id,
    board,
    message: botTurn.quip?.trim() || "I made my move.",
  });
  await answerCallbackQuery(callback.id, "Move saved");
  return true;
}
