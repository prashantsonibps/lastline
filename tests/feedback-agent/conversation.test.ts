import test from "node:test";
import assert from "node:assert/strict";
import { buildFakeVideoReadyRun, createFeedbackAgent } from "../../src/lib/feedback-agent/index.ts";

function createFakeDeps() {
  const sentTexts: string[] = [];

  return {
    sentTexts,
    deps: {
      telegram: {
        async sendReview() {
          return { messageId: "review-1", threadId: "thread-1" };
        },
        async sendMessage(input: { text: string }) {
          sentTexts.push(input.text);
          return { messageId: `message-${sentTexts.length}` };
        },
      },
      screenshots: {
        async extractScreenshot() {
          return {
            timestampSeconds: 75,
            status: "ready" as const,
            assetUrl: "/tmp/75.png",
          };
        },
      },
      issueDrafting: {
        async draftIssue() {
          return {
            title: "Draft issue",
            observedBehavior: "Observed",
            expectedBehavior: "Expected",
          };
        },
      },
      github: {
        async createIssue() {
          return {
            issueNumber: 1,
            issueUrl: "https://github.com/acme/widget-web/issues/1",
          };
        },
      },
    },
  };
}

async function startRun() {
  const fake = createFakeDeps();
  const agent = createFeedbackAgent(fake.deps);
  const run = await agent.startFeedbackForRun({
    run: buildFakeVideoReadyRun(),
    chatId: "chat-1",
  });

  return { fake, agent, run };
}

test("guides the reviewer from callback to timestamp to saved finding", async () => {
  const { agent, run } = await startRun();
  const timestampPrompted = await agent.handleTelegramEvent({
    run,
    event: { type: "callback", chatId: "chat-1", action: "report_bug" },
  });

  assert.equal(timestampPrompted.feedback?.conversation.step, "awaiting_timestamp");

  const descriptionPrompted = await agent.handleTelegramEvent({
    run: timestampPrompted,
    event: { type: "message", chatId: "chat-1", text: "1:15" },
  });

  assert.equal(descriptionPrompted.feedback?.conversation.step, "awaiting_description");

  const saved = await agent.handleTelegramEvent({
    run: descriptionPrompted,
    event: { type: "message", chatId: "chat-1", text: "CTA text overlaps with the hero image." },
  });

  assert.equal(saved.feedback?.conversation.step, "idle");
  assert.equal(saved.feedback?.findings.length, 1);
  assert.equal(saved.feedback?.findings[0]?.timestampSeconds, 75);
});

test("rejects malformed timestamps with a recovery prompt", async () => {
  const { fake, agent, run } = await startRun();
  const timestampPrompted = await agent.handleTelegramEvent({
    run,
    event: { type: "callback", chatId: "chat-1", action: "report_bug" },
  });

  const rejected = await agent.handleTelegramEvent({
    run: timestampPrompted,
    event: { type: "message", chatId: "chat-1", text: "tomorrow" },
  });

  assert.equal(rejected.feedback?.conversation.step, "awaiting_timestamp");
  assert.match(fake.sentTexts.at(-1) ?? "", /Timestamp must look like/);
});

test("blocks issue creation when no findings exist", async () => {
  const { fake, agent, run } = await startRun();
  const blocked = await agent.handleTelegramEvent({
    run,
    event: { type: "callback", chatId: "chat-1", action: "create_issues" },
  });

  assert.equal(blocked.status, "awaiting_feedback");
  assert.match(fake.sentTexts.at(-1) ?? "", /Add at least one finding/);
});
