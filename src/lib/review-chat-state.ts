import path from "node:path";
import { config } from "@/lib/config";
import { ensureDir, pathExists, readJson, writeJson } from "@/lib/fs-utils";

export type ReviewChatThreadState = {
  activeJobId?: string;
  deliveryMessageId?: string;
  platform: "telegram";
  step: "idle" | "awaiting_timestamp" | "awaiting_description";
  threadId: string;
  timestampInput?: string;
  timestampSeconds?: number;
  updatedAt: string;
};

const THREAD_STATE_FILE = path.join(config.chatStateDir, "review-thread-state.json");

type ReviewThreadDatabase = Record<string, ReviewChatThreadState>;

let queue = Promise.resolve<void>(undefined);

function createEmptyDatabase(): ReviewThreadDatabase {
  return {};
}

async function readDatabase() {
  await ensureDir(config.chatStateDir);

  if (!(await pathExists(THREAD_STATE_FILE))) {
    return createEmptyDatabase();
  }

  return readJson<ReviewThreadDatabase>(THREAD_STATE_FILE);
}

async function writeDatabase(database: ReviewThreadDatabase) {
  await ensureDir(config.chatStateDir);
  await writeJson(THREAD_STATE_FILE, database);
}

function normalizeState(threadId: string, next?: Partial<ReviewChatThreadState>) {
  return {
    threadId,
    platform: "telegram" as const,
    step: "idle" as const,
    updatedAt: new Date().toISOString(),
    ...next,
  };
}

async function withThreadState<T>(
  updater: (database: ReviewThreadDatabase) => Promise<[ReviewThreadDatabase, T]> | [ReviewThreadDatabase, T],
) {
  let result: T;

  queue = queue.then(async () => {
    const database = await readDatabase();
    const [nextDatabase, nextResult] = await updater(database);
    await writeDatabase(nextDatabase);
    result = nextResult;
  });

  await queue;
  return result!;
}

export async function getReviewChatThreadState(threadId: string) {
  const database = await readDatabase();
  return database[threadId] ?? null;
}

export async function upsertReviewChatThreadState(
  threadId: string,
  next: Partial<ReviewChatThreadState>,
) {
  return withThreadState(async (database) => {
    const current = database[threadId];
    const merged = normalizeState(threadId, {
      ...current,
      ...next,
      updatedAt: new Date().toISOString(),
    });

    database[threadId] = merged;
    return [database, merged];
  });
}

export async function resetReviewChatThreadStep(threadId: string, activeJobId?: string) {
  return upsertReviewChatThreadState(threadId, {
    activeJobId,
    step: "idle",
    timestampInput: undefined,
    timestampSeconds: undefined,
  });
}
