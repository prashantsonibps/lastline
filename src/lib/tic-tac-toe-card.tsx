/** @jsxImportSource chat */

import { Actions, Button, Card, CardText, type CardElement, toCardElement } from "chat";
import {
  getTicTacToeCellActionId,
  getWinnerAnnouncement,
  TICTACTOE_PLAY_AGAIN_ACTION_ID,
  TICTACTOE_RESET_ACTION_ID,
  type TicTacToeState,
} from "@/lib/tic-tac-toe";

function renderCellLabel(value: TicTacToeState["board"][number]) {
  return value ?? "·";
}

export function createTicTacToeCard(state: TicTacToeState, message: string): CardElement {
  return toCardElement(
    <Card title="Lastline Tic Tac Toe">
      <CardText>{message}</CardText>
      <CardText>{getWinnerAnnouncement(state.winner)}</CardText>
      <Actions>
        {state.board.slice(0, 3).map((cell, index) => (
          <Button key={`cell-${index}`} id={getTicTacToeCellActionId(index)} style={cell ? "primary" : undefined}>
            {renderCellLabel(cell)}
          </Button>
        ))}
      </Actions>
      <Actions>
        {state.board.slice(3, 6).map((cell, index) => (
          <Button key={`cell-${index + 3}`} id={getTicTacToeCellActionId(index + 3)} style={cell ? "primary" : undefined}>
            {renderCellLabel(cell)}
          </Button>
        ))}
      </Actions>
      <Actions>
        {state.board.slice(6, 9).map((cell, index) => (
          <Button key={`cell-${index + 6}`} id={getTicTacToeCellActionId(index + 6)} style={cell ? "primary" : undefined}>
            {renderCellLabel(cell)}
          </Button>
        ))}
      </Actions>
      <Actions>
        <Button id={TICTACTOE_PLAY_AGAIN_ACTION_ID} style="primary">
          Play again
        </Button>
        <Button id={TICTACTOE_RESET_ACTION_ID}>Reset</Button>
      </Actions>
    </Card>
  )!;
}
