import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatStateStore } from "./chat-state-store";
import { getLanguageModel, hasLanguageModelAccess } from "./ai-model";
import { config } from "./config";
export {
  applyMove,
  createNewTicTacToeState,
  evaluateBoard,
  getAvailableMoves,
  getFallbackMove,
  getWinnerAnnouncement,
  isTicTacToeStartMessage,
  resolveBotMoveWithRetry,
  type BotMoveRequest,
  type BotMoveResponse,
  type TicTacToeCell,
  type TicTacToeMark,
  type TicTacToeState,
  type TicTacToeStatus,
  type TicTacToeWinner,
} from "./tic-tac-toe-core";
import {
  getAvailableMoves,
  getFallbackMove,
  resolveBotMoveWithRetry,
  type BotMoveRequest,
  type BotMoveResponse,
  type TicTacToeCell,
  type TicTacToeState,
} from "./tic-tac-toe-core";

export const TICTACTOE_PLAY_AGAIN_ACTION_ID = "ttt_play_again";
export const TICTACTOE_RESET_ACTION_ID = "ttt_reset";
export const TICTACTOE_CELL_ACTION_IDS = Array.from({ length: 9 }, (_, index) => `ttt_cell_${index}`);

const TICTACTOE_STATE_PREFIX = "tictactoe:";
const tictactoeMoveSchema = z.object({
  move: z.number().int().min(0).max(8),
  quip: z.string().trim().max(120).optional(),
});

export function getTicTacToeStateKey(threadId: string) {
  return `${TICTACTOE_STATE_PREFIX}${threadId}`;
}

export async function getTicTacToeState(threadId: string) {
  return getChatStateStore().get<TicTacToeState>(getTicTacToeStateKey(threadId));
}

export async function setTicTacToeState(threadId: string, state: TicTacToeState) {
  await getChatStateStore().set(getTicTacToeStateKey(threadId), state);
}

export async function clearTicTacToeState(threadId: string) {
  await getChatStateStore().delete(getTicTacToeStateKey(threadId));
}

export function getTicTacToeCellActionId(index: number) {
  return `ttt_cell_${index}`;
}

export function parseTicTacToeCellActionId(actionId: string) {
  const match = actionId.match(/^ttt_cell_(\d)$/);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  return index >= 0 && index <= 8 ? index : null;
}

export function isTicTacToeAction(actionId: string) {
  return actionId === TICTACTOE_PLAY_AGAIN_ACTION_ID || actionId === TICTACTOE_RESET_ACTION_ID || parseTicTacToeCellActionId(actionId) !== null;
}

function formatBoardForPrompt(board: TicTacToeCell[]) {
  return board
    .map((cell, index) => `${index}:${cell ?? "-"}`)
    .reduce<string[][]>((rows, cell, index) => {
      const rowIndex = Math.floor(index / 3);
      rows[rowIndex] ??= [];
      rows[rowIndex].push(cell);
      return rows;
    }, [])
    .map((row) => row.join(" "))
    .join("\n");
}

async function requestBotMoveFromModel(input: BotMoveRequest): Promise<BotMoveResponse> {
  const { output } = await generateText({
    model: getLanguageModel(config.ticTacToeModel),
    output: Output.object({
      schema: tictactoeMoveSchema,
    }),
    temperature: 0.4,
    system: [
      "You play Tic Tac Toe as O against a human playing X.",
      "Return exactly one legal move index from 0 to 8 for O.",
      "Never choose an occupied square.",
      "Keep any quip short, playful, and under 120 characters.",
      "Do not explain your strategy.",
    ].join(" "),
    prompt: [
      `Attempt: ${input.attempt}`,
      "Board cells are indexed left-to-right, top-to-bottom.",
      "Use this mapping:",
      "0 1 2",
      "3 4 5",
      "6 7 8",
      "",
      "Current board:",
      formatBoardForPrompt(input.board),
      "",
      `Available moves: ${getAvailableMoves(input.board).join(", ")}`,
      "Choose the best move for O.",
      input.attempt > 1 ? "Important: your previous move was rejected, so only return a legal empty square." : "",
    ].filter(Boolean).join("\n"),
  });

  return output;
}

export async function resolveBotTurn(
  board: TicTacToeCell[],
  requestMove: (input: BotMoveRequest) => Promise<BotMoveResponse> = requestBotMoveFromModel,
) {
  if (!hasLanguageModelAccess()) {
    const move = getFallbackMove(board);

    return {
      move,
      quip: move === null ? "" : "I had to improvise without Gemini, but I still found a move.",
      source: "fallback" as const,
    };
  }

  return resolveBotMoveWithRetry(board, requestMove);
}
