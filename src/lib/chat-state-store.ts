import { randomUUID } from "node:crypto";
import type { Lock, StateAdapter } from "chat";
import { readDurableJson, writeDurableJson } from "@/lib/durable-json-store";

type StoredValue = {
  expiresAt?: number;
  value: unknown;
};

type StoredList = {
  expiresAt?: number;
  values: unknown[];
};

type ChatStateDatabase = {
  cache: Record<string, StoredValue>;
  lists: Record<string, StoredList>;
  locks: Record<string, Lock>;
  subscriptions: Record<string, true>;
};

const DATABASE_FILE = "state/chat/state.json";

function createEmptyDatabase(): ChatStateDatabase {
  return {
    cache: {},
    lists: {},
    locks: {},
    subscriptions: {},
  };
}

function isExpired(expiresAt?: number) {
  return typeof expiresAt === "number" && expiresAt <= Date.now();
}

export class FileChatStateStore implements StateAdapter {
  private queue = Promise.resolve<void>(undefined);

  async connect() {
    if (!(await readDurableJson<ChatStateDatabase>(DATABASE_FILE))) {
      await writeDurableJson(DATABASE_FILE, createEmptyDatabase());
    }
  }

  async disconnect() {
    return;
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    return this.withDatabase(async (database) => {
      const existing = database.locks[threadId];

      if (existing && existing.expiresAt > Date.now()) {
        return [database, null];
      }

      const lock: Lock = {
        threadId,
        token: randomUUID(),
        expiresAt: Date.now() + ttlMs,
      };

      database.locks[threadId] = lock;
      return [database, lock];
    });
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    return this.withDatabase(async (database) => {
      const existing = database.locks[lock.threadId];

      if (!existing || existing.token !== lock.token || existing.expiresAt <= Date.now()) {
        return [database, false];
      }

      database.locks[lock.threadId] = {
        ...existing,
        expiresAt: Date.now() + ttlMs,
      };

      return [database, true];
    });
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    await this.withDatabase(async (database) => {
      delete database.locks[threadId];
      return [database, undefined];
    });
  }

  async releaseLock(lock: Lock): Promise<void> {
    await this.withDatabase(async (database) => {
      const existing = database.locks[lock.threadId];

      if (existing?.token === lock.token) {
        delete database.locks[lock.threadId];
      }

      return [database, undefined];
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.withDatabase(async (database) => {
      const entry = database.cache[key];

      if (!entry) {
        return [database, null];
      }

      return [database, entry.value as T];
    });
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.withDatabase(async (database) => {
      database.cache[key] = {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      };

      return [database, undefined];
    });
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    return this.withDatabase(async (database) => {
      if (database.cache[key]) {
        return [database, false];
      }

      database.cache[key] = {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      };

      return [database, true];
    });
  }

  async delete(key: string): Promise<void> {
    await this.withDatabase(async (database) => {
      delete database.cache[key];
      delete database.lists[key];
      return [database, undefined];
    });
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    return this.withDatabase(async (database) => {
      const entry = database.lists[key];
      return [database, (entry?.values ?? []) as T[]];
    });
  }

  async appendToList(key: string, value: unknown, options?: { maxLength?: number; ttlMs?: number }): Promise<void> {
    await this.withDatabase(async (database) => {
      const current = database.lists[key]?.values ?? [];
      const next = [...current, value];
      const trimmed =
        typeof options?.maxLength === "number" && options.maxLength > 0
          ? next.slice(-options.maxLength)
          : next;

      database.lists[key] = {
        values: trimmed,
        expiresAt: options?.ttlMs ? Date.now() + options.ttlMs : undefined,
      };

      return [database, undefined];
    });
  }

  async subscribe(threadId: string): Promise<void> {
    await this.withDatabase(async (database) => {
      database.subscriptions[threadId] = true;
      return [database, undefined];
    });
  }

  async unsubscribe(threadId: string): Promise<void> {
    await this.withDatabase(async (database) => {
      delete database.subscriptions[threadId];
      return [database, undefined];
    });
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return this.withDatabase(async (database) => {
      return [database, Boolean(database.subscriptions[threadId])];
    });
  }

  private async withDatabase<T>(
    mutator: (database: ChatStateDatabase) => Promise<[ChatStateDatabase, T]> | [ChatStateDatabase, T],
  ): Promise<T> {
    let result: T;

    this.queue = this.queue.then(async () => {
      await this.connect();
      const database = await this.readDatabase();
      const [nextDatabase, nextResult] = await mutator(this.pruneExpired(database));
      await writeDurableJson(DATABASE_FILE, nextDatabase);
      result = nextResult;
    });

    await this.queue;
    return result!;
  }

  private async readDatabase() {
    return (await readDurableJson<ChatStateDatabase>(DATABASE_FILE)) ?? createEmptyDatabase();
  }

  private pruneExpired(database: ChatStateDatabase) {
    for (const [key, value] of Object.entries(database.cache)) {
      if (isExpired(value.expiresAt)) {
        delete database.cache[key];
      }
    }

    for (const [key, value] of Object.entries(database.lists)) {
      if (isExpired(value.expiresAt)) {
        delete database.lists[key];
      }
    }

    for (const [threadId, lock] of Object.entries(database.locks)) {
      if (lock.expiresAt <= Date.now()) {
        delete database.locks[threadId];
      }
    }

    return database;
  }
}

let singleton: FileChatStateStore | undefined;

export function getChatStateStore() {
  singleton ??= new FileChatStateStore();
  return singleton;
}
