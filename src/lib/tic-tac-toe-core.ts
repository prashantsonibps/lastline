export type TicTacToeMark = "X" | "O";
export type TicTacToeCell = TicTacToeMark | null;
export type TicTacToeWinner = TicTacToeMark | "draw" | null;
export type TicTacToeStatus = "idle" | "active" | "finished";

export type TicTacToeState = {
  status: TicTacToeStatus;
  board: TicTacToeCell[];
  currentTurn: TicTacToeMark;
  winner: TicTacToeWinner;
  lastBoardMessageId: string | null;
  lastCommentary: string | null;
};

export type BotMoveRequest = {
  board: TicTacToeCell[];
  attempt: number;
};

export type BotMoveResponse = {
  move: number;
  quip?: string;
};

export function createNewTicTacToeState(): TicTacToeState {
  return {
    status: "active",
    board: Array.from({ length: 9 }, () => null),
    currentTurn: "X",
    winner: null,
    lastBoardMessageId: null,
    lastCommentary: null,
  };
}

export function isTicTacToeStartMessage(text: string) {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized === "/tictactoe" ||
    normalized.startsWith("/tictactoe@") ||
    normalized === "tictactoe" ||
    /\bbored\b/.test(normalized)
  );
}

export function getAvailableMoves(board: TicTacToeCell[]) {
  return board.flatMap((cell, index) => (cell === null ? [index] : []));
}

export function evaluateBoard(board: TicTacToeCell[]): TicTacToeWinner {
  const winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of winningLines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return board.every((cell) => cell !== null) ? "draw" : null;
}

export function applyMove(state: TicTacToeState, index: number, player: TicTacToeMark): TicTacToeState {
  if (state.status !== "active") {
    throw new Error("The current game is already finished. Tap Play again to start a new round.");
  }

  if (state.currentTurn !== player) {
    throw new Error(player === "X" ? "Wait for your turn before placing another X." : "The bot is not allowed to move yet.");
  }

  if (!Number.isInteger(index) || index < 0 || index > 8) {
    throw new Error("That move is outside the board.");
  }

  if (state.board[index] !== null) {
    throw new Error("That square is already taken. Pick another one.");
  }

  const board = [...state.board];
  board[index] = player;
  const winner = evaluateBoard(board);

  return {
    ...state,
    board,
    currentTurn: winner ? player : player === "X" ? "O" : "X",
    status: winner ? "finished" : "active",
    winner,
  };
}

export function getWinnerAnnouncement(winner: TicTacToeWinner) {
  if (winner === "X") {
    return "You win. Nicely played.";
  }

  if (winner === "O") {
    return "I win this round. Want another shot?";
  }

  if (winner === "draw") {
    return "Draw. We matched each other move for move.";
  }

  return "Your turn. Tap a square to place X.";
}

export function getFallbackMove(board: TicTacToeCell[]) {
  const preferredOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  return preferredOrder.find((index) => board[index] === null) ?? null;
}

export async function resolveBotMoveWithRetry(
  board: TicTacToeCell[],
  requestMove: (input: BotMoveRequest) => Promise<BotMoveResponse>,
) {
  for (const attempt of [1, 2]) {
    try {
      const result = await requestMove({ board, attempt });
      if (board[result.move] === null) {
        return {
          move: result.move,
          quip: result.quip?.trim() || "My turn.",
          source: "model" as const,
        };
      }
    } catch {
      // Retry, then fall back if needed.
    }
  }

  const move = getFallbackMove(board);
  return {
    move,
    quip: move === null ? "" : "Gemini blinked, so I grabbed the safest square instead.",
    source: "fallback" as const,
  };
}
