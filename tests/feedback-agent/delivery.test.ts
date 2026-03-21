import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFakeVideoReadyRun,
  createFeedbackAgent,
  formatReviewSummary,
} from "../../src/lib/feedback-agent/index.ts";

function createFakeDeps() {
  const sent: { kind: "review" | "message"; payload: Record<string, unknown> }[] = [];

  return {
    sent,
    deps: {
      telegram: {
        async sendReview(input: Record<string, unknown>) {
          sent.push({ kind: "review", payload: input });
          return { messageId: "1001", threadId: "77" };
        },
        async sendMessage(input: Record<string, unknown>) {
          sent.push({ kind: "message", payload: input });
          return { messageId: "1002" };
        },
      },
      screenshots: {
        async extractScreenshot() {
          return {
            timestampSeconds: 0,
            status: "ready" as const,
            assetUrl: "/tmp/0.png",
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

test("formats an ordered human-readable review summary", () => {
  const summary = formatReviewSummary(buildFakeVideoReadyRun());

  assert.match(summary, /PR Review Ready: #42/);
  assert.match(summary, /1\. Review pricing hero and CTA flow/);
  assert.match(summary, /2\. Review checkout summary/);
});

test("delivers the summary and video to Telegram then binds the run to the thread", async () => {
  const fake = createFakeDeps();
  const agent = createFeedbackAgent(fake.deps);

  const updated = await agent.startFeedbackForRun({
    run: buildFakeVideoReadyRun(),
    chatId: "123456",
  });

  assert.equal(updated.status, "awaiting_feedback");
  assert.equal(updated.feedback?.telegram?.chatId, "123456");
  assert.equal(updated.feedback?.telegram?.deliveryMessageId, "1001");
  assert.equal(fake.sent[0]?.kind, "review");
});
