/** @jsxImportSource chat */

import { Actions, Button, Card, CardText, Chat, type ActionEvent, type Thread, toAiMessages, toCardElement } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { getChatStateStore } from "@/lib/chat-state-store";
import { config } from "@/lib/config";
import { getReviewJob, listReviewJobs, updateReviewJob } from "@/lib/review-jobs-store";
import { getReviewChatThreadState, resetReviewChatThreadStep, upsertReviewChatThreadState } from "@/lib/review-chat-state";
import { createReviewAssistant } from "@/lib/review-assistant/agent";
import {
  buildReviewDeliverySummary,
  createReviewIssuesOperation,
  inspectReviewJobOperation,
  loadReviewVideoUpload,
  saveReviewFindingOperation,
} from "@/lib/review-assistant/operations";
import { normalizeTimestampToSeconds } from "@/lib/feedback-agent/timestamps";
import {
  applyMove,
  clearTicTacToeState,
  createNewTicTacToeState,
  getTicTacToeState,
  isTicTacToeStartMessage,
  parseTicTacToeCellActionId,
  resolveBotTurn,
  setTicTacToeState,
  TICTACTOE_CELL_ACTION_IDS,
  TICTACTOE_PLAY_AGAIN_ACTION_ID,
  TICTACTOE_RESET_ACTION_ID,
} from "@/lib/tic-tac-toe";
import { createTicTacToeCard } from "@/lib/tic-tac-toe-card";

function createActionCard(summary: string) {
  return toCardElement(
    <Card title="Review Ready">
      <CardText>{summary}</CardText>
      <Actions>
        <Button id="report_bug" style="primary">
          Report bug
        </Button>
        <Button id="create_issues">Create issues</Button>
      </Actions>
    </Card>
  )!;
}

function createFindingSavedCard(message: string) {
  return toCardElement(
    <Card title="Finding Saved">
      <CardText>{message}</CardText>
      <Actions>
        <Button id="report_bug" style="primary">
          Report bug
        </Button>
        <Button id="add_another">
          Add another
        </Button>
        <Button id="create_issues">Create issues</Button>
      </Actions>
    </Card>
  )!;
}

function createIssuesCreatedCard(message: string) {
  return toCardElement(
    <Card title="Issues Created">
      <CardText>{message}</CardText>
      <Actions>
        <Button id="report_bug" style="primary">
          Report bug
        </Button>
      </Actions>
    </Card>
  )!;
}

function extractRequestedJobId(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/(?:job|bind)\s+([a-f0-9-]{8,})/i) ?? trimmed.match(/^([a-f0-9-]{8,})$/i);
  return match?.[1];
}

async function listDeliverableJobs() {
  const jobs = await listReviewJobs();
  return jobs.filter((job) => job.status === "video_ready" || job.status === "awaiting_feedback" || job.status === "done");
}

async function postJobSelectionPrompt(threadId: string) {
  const telegram = reviewBot.getAdapter("telegram");
  const jobs = await listDeliverableJobs();

  const markdown =
    jobs.length === 0
      ? "No `video_ready` review jobs are available yet. Run `/api/reviews/run` or wait for an incoming PR review job."
      : [
          "Send `job <id>` to bind this chat to a review job.",
          "",
          ...jobs.slice(0, 8).map((job) => `- ${job.id} · ${job.repo.owner}/${job.repo.name} #${job.pr.number} · ${job.status}`),
        ].join("\n");

  await telegram.postMessage(threadId, {
    markdown,
  });
}

async function ensureBoundJobFromMessage(threadId: string, text: string) {
  const requestedJobId = extractRequestedJobId(text);

  if (!requestedJobId) {
    return null;
  }

  const job = await getReviewJob(requestedJobId);

  if (!job) {
    return null;
  }

  await upsertReviewChatThreadState(threadId, {
    activeJobId: job.id,
    step: "idle",
  });

  return job.id;
}

async function postPromptForTimestamp(threadId: string) {
  const telegram = reviewBot.getAdapter("telegram");
  await telegram.postMessage(threadId, {
    markdown: "Send the timestamp for the issue you spotted. Formats like `75`, `1:15`, or `00:01:15` all work.",
  });
}

async function postReviewDelivery(threadId: string, jobId: string) {
  const telegram = reviewBot.getAdapter("telegram");
  const job = await getReviewJob(jobId);

  if (!job) {
    throw new Error(`Review job ${jobId} not found.`);
  }

  const summary = buildReviewDeliverySummary(job);
  const result = await telegram.postMessage(threadId, {
    card: createActionCard(summary),
    fallbackText: summary,
    files: [await loadReviewVideoUpload(job)],
  });

  return {
    deliveryMessageId: result.id,
    summary,
  };
}

export async function deliverReviewToTelegram(input: {
  chatId?: string;
  jobId: string;
  threadId?: string;
}) {
  if (!input.chatId) {
    throw new Error("Telegram chat id is required.");
  }

  await reviewBot.initialize();

  const telegram = reviewBot.getAdapter("telegram");
  const resolvedThreadId = telegram.encodeThreadId({
    chatId: input.chatId,
    messageThreadId: input.threadId ? Number(input.threadId) : undefined,
  });
  const job = await getReviewJob(input.jobId);

  if (!job) {
    throw new Error(`Review job ${input.jobId} not found.`);
  }

  const { deliveryMessageId, summary } = await postReviewDelivery(resolvedThreadId, input.jobId);
  await reviewBot.getState().subscribe(resolvedThreadId);
  await upsertReviewChatThreadState(resolvedThreadId, {
    activeJobId: input.jobId,
    deliveryMessageId,
    step: "idle",
  });

  const updatedJob = await updateReviewJob(job.id, (current) => ({
    ...current,
    status: "awaiting_feedback",
    feedback: {
      ...current.feedback!,
      delivery: {
        deliveredAt: new Date().toISOString(),
        summary,
        videoUrl: current.artifacts?.finalVideoUrl ?? current.handoff?.stitchedVideo?.location ?? "",
      },
      telegram: {
        chatId: input.chatId!,
        deliveryMessageId,
        threadId: input.threadId,
      },
      conversation: { step: "idle" },
    },
  }));

  return {
    ok: true,
    job: await inspectReviewJobOperation(updatedJob.id),
    threadId: resolvedThreadId,
    deliveryMessageId,
  };
}

async function handleUnboundThread(threadId: string, text: string) {
  const boundJobId = await ensureBoundJobFromMessage(threadId, text);

  if (boundJobId) {
    const { deliveryMessageId } = await postReviewDelivery(threadId, boundJobId);
    await upsertReviewChatThreadState(threadId, {
      activeJobId: boundJobId,
      deliveryMessageId,
      step: "idle",
    });
    return;
  }

  await postJobSelectionPrompt(threadId);
}

async function postTicTacToeBoard(thread: Thread<unknown>, message: string) {
  const state = (await getTicTacToeState(thread.id)) ?? createNewTicTacToeState();
  const sent = await thread.post(createTicTacToeCard(state, message));
  const nextState = {
    ...state,
    lastBoardMessageId: sent.id,
  };
  await setTicTacToeState(thread.id, nextState);
  return nextState;
}

async function startOrResumeTicTacToe(thread: Thread<unknown>) {
  const existingState = await getTicTacToeState(thread.id);

  if (existingState?.status === "active") {
    await postTicTacToeBoard(thread, "Game already in progress. You are X and I am O.");
    return true;
  }

  const nextState = createNewTicTacToeState();
  await setTicTacToeState(thread.id, nextState);
  await postTicTacToeBoard(thread, "You said you were bored, so I brought a board. You go first as X.");
  return true;
}

async function maybeStartTicTacToe(thread: Thread<unknown>, text: string) {
  if (!isTicTacToeStartMessage(text)) {
    return false;
  }

  await startOrResumeTicTacToe(thread);
  return true;
}

async function handleTicTacToeAction(event: ActionEvent) {
  if (!event.thread) {
    return;
  }

  if (event.actionId === TICTACTOE_RESET_ACTION_ID) {
    await clearTicTacToeState(event.thread.id);
    await event.thread.post("Tic Tac Toe reset. Say `bored` or `/tictactoe` when you want another round.");
    return;
  }

  if (event.actionId === TICTACTOE_PLAY_AGAIN_ACTION_ID) {
    await setTicTacToeState(event.thread.id, createNewTicTacToeState());
    await postTicTacToeBoard(event.thread, "Fresh board. You are X again.");
    return;
  }

  const cellIndex = parseTicTacToeCellActionId(event.actionId);

  if (cellIndex === null) {
    return;
  }

  const currentState = await getTicTacToeState(event.thread.id);

  if (!currentState) {
    await event.thread.post("No active Tic Tac Toe game yet. Say `bored` or `/tictactoe` to start one.");
    return;
  }

  let afterHumanMove;
  try {
    afterHumanMove = applyMove(currentState, cellIndex, "X");
  } catch (error) {
    await event.thread.post(error instanceof Error ? error.message : "That move did not work.");
    return;
  }

  await setTicTacToeState(event.thread.id, afterHumanMove);

  if (afterHumanMove.status === "finished") {
    await postTicTacToeBoard(event.thread, "You locked in your move.");
    return;
  }

  await event.thread.startTyping("Thinking...");
  const botTurn = await resolveBotTurn(afterHumanMove.board);

  if (typeof botTurn.move !== "number") {
    await postTicTacToeBoard(event.thread, "The board is full. That round is over.");
    return;
  }

  let afterBotMove;
  try {
    afterBotMove = applyMove(afterHumanMove, botTurn.move, "O");
  } catch {
    afterBotMove = afterHumanMove;
  }

  const finalState = {
    ...afterBotMove,
    lastCommentary: botTurn.quip ?? null,
  };
  await setTicTacToeState(event.thread.id, finalState);
  await postTicTacToeBoard(event.thread, botTurn.quip?.trim() || "I made my move.");
}

async function handleIdleMessage(thread: Thread, text: string) {
  const state = await getReviewChatThreadState(thread.id);

  if (!state?.activeJobId) {
    await handleUnboundThread(thread.id, text);
    return;
  }

  const assistant = createReviewAssistant({
    surface: "telegram",
    activeJobId: state.activeJobId,
  });

  const history = [];
  for await (const message of thread.allMessages) {
    history.push(message);
  }

  const prompt = await toAiMessages(history.slice(-12), {
    includeNames: true,
  });
  const result = await assistant.stream({
    prompt,
  });

  await thread.post(result.fullStream);
}

export const reviewBot = new Chat({
  userName: config.telegramBotUsername ?? "lastline",
  adapters: {
    telegram: createTelegramAdapter({
      botToken: config.telegramBotToken,
      secretToken: config.telegramWebhookSecret,
      userName: config.telegramBotUsername,
    }),
  },
  state: getChatStateStore(),
  fallbackStreamingPlaceholderText: "Reviewing...",
  logger: "warn",
}).registerSingleton();

reviewBot.onDirectMessage(async (thread, message) => {
  await thread.subscribe();
  if (await maybeStartTicTacToe(thread, message.text)) {
    return;
  }
  await handleUnboundThread(thread.id, message.text);
});

reviewBot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  if (await maybeStartTicTacToe(thread, message.text)) {
    return;
  }
  await handleUnboundThread(thread.id, message.text);
});

reviewBot.onAction(
  [...TICTACTOE_CELL_ACTION_IDS, TICTACTOE_PLAY_AGAIN_ACTION_ID, TICTACTOE_RESET_ACTION_ID],
  async (event) => {
    await handleTicTacToeAction(event);
  },
);

reviewBot.onAction(["report_bug", "add_another"], async (event) => {
  if (!event.thread) {
    return;
  }

  const state = await getReviewChatThreadState(event.thread.id);

  if (!state?.activeJobId) {
    await event.thread.post("Bind this thread to a review job first by sending `job <id>`.");
    return;
  }

  await upsertReviewChatThreadState(event.thread.id, {
    activeJobId: state.activeJobId,
    step: "awaiting_timestamp",
    timestampInput: undefined,
    timestampSeconds: undefined,
  });

  await postPromptForTimestamp(event.thread.id);
});

reviewBot.onAction("create_issues", async (event) => {
  if (!event.thread) {
    return;
  }

  const state = await getReviewChatThreadState(event.thread.id);

  if (!state?.activeJobId) {
    await event.thread.post("Bind this thread to a review job first by sending `job <id>`.");
    return;
  }

  const result = await createReviewIssuesOperation({
    jobId: state.activeJobId,
  });

  await event.thread.post(
    createIssuesCreatedCard(`Created ${result.createdIssues.length} issue(s) for review job ${state.activeJobId}.`),
  );
  await resetReviewChatThreadStep(event.thread.id, state.activeJobId);
});

reviewBot.onSubscribedMessage(async (thread, message) => {
  if (await maybeStartTicTacToe(thread, message.text)) {
    return;
  }

  const state = (await getReviewChatThreadState(thread.id)) ?? {
    threadId: thread.id,
    platform: "telegram" as const,
    step: "idle" as const,
    updatedAt: new Date().toISOString(),
  };

  if (!state.activeJobId) {
    await handleUnboundThread(thread.id, message.text);
    return;
  }

  if (state.step === "awaiting_timestamp") {
    try {
      const timestampSeconds = normalizeTimestampToSeconds(message.text);
      await upsertReviewChatThreadState(thread.id, {
        activeJobId: state.activeJobId,
        step: "awaiting_description",
        timestampInput: message.text.trim(),
        timestampSeconds,
      });
      await thread.post(`Saved timestamp ${message.text.trim()}. Now describe the issue you saw.`);
    } catch (error) {
      await thread.post(
        error instanceof Error
          ? `${error.message} Please reply with a valid timestamp before we save the finding.`
          : "Please reply with a valid timestamp before we save the finding.",
      );
    }
    return;
  }

  if (state.step === "awaiting_description" && state.timestampInput && typeof state.timestampSeconds === "number") {
    const result = await saveReviewFindingOperation({
      jobId: state.activeJobId,
      timestamp: state.timestampInput,
      description: message.text.trim(),
    });
    await resetReviewChatThreadStep(thread.id, state.activeJobId);
    await thread.post(
      createFindingSavedCard(`Saved your finding at ${result.finding.timestamp} for review job ${state.activeJobId}.`),
    );
    return;
  }

  await handleIdleMessage(thread, message.text);
});
