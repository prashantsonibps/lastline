import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFakeVideoReadyRun,
  transitionFeedbackRun,
  validateFeedbackReadyRun,
} from "../../src/lib/feedback-agent/index.ts";

test("bootstraps a fake video_ready run against the implemented contract", () => {
  const run = buildFakeVideoReadyRun();
  const validated = validateFeedbackReadyRun(run);

  assert.equal(validated.status, "video_ready");
  assert.equal(validated.tasks.length, 2);
  assert.equal(validated.artifacts?.finalVideoUrl, "https://example.com/reviews/final-review.mp4");
  assert.deepEqual(validated.feedback?.findings, []);
});

test("rejects runs that are missing the durable video reference", () => {
  const run = buildFakeVideoReadyRun({
    artifacts: {
      taskArtifacts: [],
      finalVideoUrl: "",
    },
  });

  assert.throws(() => validateFeedbackReadyRun(run), /finalVideoUrl/i);
});

test("allows only the declared feedback state transitions", () => {
  const awaitingFeedback = transitionFeedbackRun(buildFakeVideoReadyRun(), "awaiting_feedback");
  const creatingIssues = transitionFeedbackRun(awaitingFeedback, "creating_issues");
  const done = transitionFeedbackRun(creatingIssues, "done");

  assert.equal(done.status, "done");
  assert.throws(() => transitionFeedbackRun(done, "awaiting_feedback"), /Cannot transition/);
});
