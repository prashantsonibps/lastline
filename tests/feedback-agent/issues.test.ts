import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFakeVideoReadyRun,
  createFeedbackAgent,
  normalizeTimestampToSeconds,
  renderIssueBody,
} from "../../src/lib/feedback-agent/index.ts";

test("normalizes supported timestamp formats into integer seconds", () => {
  assert.equal(normalizeTimestampToSeconds("75"), 75);
  assert.equal(normalizeTimestampToSeconds("1:15"), 75);
  assert.equal(normalizeTimestampToSeconds("01:01:15"), 3675);
});

test("reuses screenshots for findings that share a timestamp and still creates issues when extraction fails", async () => {
  const screenshotCalls: number[] = [];
  const createdBodies: string[] = [];
  const sentTexts: string[] = [];

  const agent = createFeedbackAgent({
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
      async extractScreenshot({ timestampSeconds }) {
        screenshotCalls.push(timestampSeconds);
        if (timestampSeconds === 90) {
          return {
            timestampSeconds,
            status: "failed" as const,
            error: "ffmpeg could not decode frame",
          };
        }

        return {
          timestampSeconds,
          status: "ready" as const,
          assetUrl: `/tmp/${timestampSeconds}.png`,
        };
      },
    },
    issueDrafting: {
      async draftIssue({ finding }) {
        return {
          title: `Issue for ${finding.timestampSeconds}`,
          observedBehavior: finding.description,
          expectedBehavior: "The UI should render without the reported glitch.",
        };
      },
    },
    github: {
      async createIssue({ body, title }) {
        createdBodies.push(body);
        return {
          issueNumber: createdBodies.length,
          issueUrl: `https://github.com/acme/widget-web/issues/${createdBodies.length}?title=${encodeURIComponent(title)}`,
        };
      },
    },
  });

  let run = await agent.startFeedbackForRun({
    run: buildFakeVideoReadyRun(),
    chatId: "chat-1",
  });

  run = {
    ...run,
    feedback: {
      ...run.feedback!,
      findings: [
        {
          id: "finding-1",
          createdAt: "2026-03-21T10:05:00.000Z",
          timestampInput: "1:15",
          timestampSeconds: 75,
          description: "Primary CTA overlaps the hero image.",
        },
        {
          id: "finding-2",
          createdAt: "2026-03-21T10:06:00.000Z",
          timestampInput: "1:15",
          timestampSeconds: 75,
          description: "Button shadow jitters when hovered.",
        },
        {
          id: "finding-3",
          createdAt: "2026-03-21T10:07:00.000Z",
          timestampInput: "1:30",
          timestampSeconds: 90,
          description: "Checkout total disappears briefly.",
        },
      ],
    },
  };

  const done = await agent.createIssuesForRun({ run });

  assert.equal(done.status, "done");
  assert.deepEqual(screenshotCalls, [75, 90]);
  assert.equal(done.feedback?.createdIssues.length, 3);
  assert.match(createdBodies[2] ?? "", /ffmpeg could not decode frame/);
});

test("renders issue bodies with the fixed template and original user note", () => {
  const run = buildFakeVideoReadyRun();
  const body = renderIssueBody({
    run,
    finding: {
      id: "finding-1",
      createdAt: "2026-03-21T10:05:00.000Z",
      timestampInput: "1:15",
      timestampSeconds: 75,
      description: "CTA overlaps the hero image.",
      screenshot: {
        timestampSeconds: 75,
        status: "ready",
        assetUrl: "/tmp/75.png",
      },
    },
    draft: {
      title: "CTA overlaps hero image",
      observedBehavior: "CTA overlaps the hero image.",
      expectedBehavior: "CTA should remain readable beside the hero image.",
    },
  });

  assert.match(body, /## Original User Note/);
  assert.match(body, /CTA overlaps the hero image\./);
  assert.match(body, /## Full Review Video/);
});
