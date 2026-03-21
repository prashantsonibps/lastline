import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMove,
  createNewTicTacToeState,
  evaluateBoard,
  getFallbackMove,
  isTicTacToeStartMessage,
  resolveBotMoveWithRetry,
} from "../../src/lib/tic-tac-toe-core.ts";

test("detects boredom phrases and slash command triggers", () => {
  assert.equal(isTicTacToeStartMessage("I am bored"), true);
  assert.equal(isTicTacToeStartMessage("bored."), true);
  assert.equal(isTicTacToeStartMessage("/tictactoe"), true);
  assert.equal(isTicTacToeStartMessage("review this job"), false);
});

test("applies legal moves and flips the turn", () => {
  const initial = createNewTicTacToeState();
  const afterHuman = applyMove(initial, 0, "X");

  assert.equal(afterHuman.board[0], "X");
  assert.equal(afterHuman.currentTurn, "O");
  assert.equal(afterHuman.status, "active");
});

test("rejects moves into occupied cells", () => {
  const initial = createNewTicTacToeState();
  const afterHuman = applyMove(initial, 0, "X");

  assert.throws(() => applyMove(afterHuman, 0, "O"), /already taken/);
});

test("detects wins across rows diagonals and draws", () => {
  assert.equal(evaluateBoard(["X", "X", "X", null, null, null, null, null, null]), "X");
  assert.equal(evaluateBoard(["O", null, null, null, "O", null, null, null, "O"]), "O");
  assert.equal(evaluateBoard(["X", "O", "X", "X", "O", "O", "O", "X", "X"]), "draw");
});

test("falls back to a deterministic move preference when needed", () => {
  assert.equal(getFallbackMove([null, null, null, null, null, null, null, null, null]), 4);
  assert.equal(getFallbackMove(["X", null, null, null, "O", null, null, null, null]), 2);
});

test("retries invalid bot moves and accepts the second legal move", async () => {
  let calls = 0;
  const result = await resolveBotMoveWithRetry(["X", null, null, null, null, null, null, null, null], async () => {
    calls += 1;

    return calls === 1 ? { move: 0, quip: "oops" } : { move: 4, quip: "Center stage." };
  });

  assert.equal(calls, 2);
  assert.equal(result.move, 4);
  assert.equal(result.source, "model");
});

test("falls back after repeated invalid bot moves", async () => {
  const result = await resolveBotMoveWithRetry(["X", null, null, null, null, null, null, null, null], async () => ({
    move: 0,
    quip: "still wrong",
  }));

  assert.equal(result.move, 4);
  assert.equal(result.source, "fallback");
});
