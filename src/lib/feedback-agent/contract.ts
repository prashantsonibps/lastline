import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FeedbackState, ReviewJob, ReviewJobStatus } from "../types.ts";

const feedbackStateSchema = z.object({
  delivery: z
    .object({
      deliveredAt: z.string().datetime(),
      summary: z.string().min(1),
      videoUrl: z.string().min(1),
    })
    .optional(),
  telegram: z
    .object({
      chatId: z.string().min(1),
      deliveryMessageId: z.string().min(1),
      threadId: z.string().min(1).optional(),
      lastPromptMessageId: z.string().min(1).optional(),
    })
    .optional(),
  conversation: z.discriminatedUnion("step", [
    z.object({ step: z.literal("idle") }),
    z.object({ step: z.literal("awaiting_timestamp") }),
    z.object({
      step: z.literal("awaiting_description"),
      timestampInput: z.string().min(1),
      timestampSeconds: z.number().int().nonnegative(),
    }),
  ]),
  findings: z.array(
    z.object({
      id: z.string().min(1),
      createdAt: z.string().datetime(),
      timestampInput: z.string().min(1),
      timestampSeconds: z.number().int().nonnegative(),
      description: z.string().min(1),
      screenshot: z
        .object({
          timestampSeconds: z.number().int().nonnegative(),
          status: z.enum(["ready", "failed"]),
          assetUrl: z.string().min(1).optional(),
          error: z.string().min(1).optional(),
        })
        .optional(),
      issue: z
        .object({
          findingId: z.string().min(1),
          issueNumber: z.number().int().positive(),
          issueUrl: z.string().url(),
          title: z.string().min(1),
        })
        .optional(),
    }),
  ),
  screenshotsByTimestamp: z.record(
    z.string(),
    z.object({
      timestampSeconds: z.number().int().nonnegative(),
      status: z.enum(["ready", "failed"]),
      assetUrl: z.string().min(1).optional(),
      error: z.string().min(1).optional(),
    }),
  ),
  createdIssues: z.array(
    z.object({
      findingId: z.string().min(1),
      issueNumber: z.number().int().positive(),
      issueUrl: z.string().url(),
      title: z.string().min(1),
    }),
  ),
});

const feedbackReadyRunSchema = z.object({
  id: z.string().min(1),
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    cloneUrl: z.string().min(1),
  }),
  pr: z.object({
    number: z.number().int().positive(),
    title: z.string().min(1),
    body: z.string(),
    headRef: z.string().min(1),
    baseRef: z.string().min(1),
    headSha: z.string().min(1),
    url: z.string().url(),
  }),
  status: z.enum(["video_ready", "awaiting_feedback", "creating_issues", "done", "failed"]),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        goal: z.string().min(1),
        steps: z.array(z.string().min(1)).min(1),
        expected: z.array(z.string().min(1)).min(1),
        startUrl: z.string().min(1),
        actions: z.array(z.object({ type: z.string() })).min(1),
      }),
    )
    .min(1),
  artifacts: z.object({
    taskArtifacts: z.array(
      z.object({
        taskId: z.string().min(1),
        introCardPath: z.string().min(1),
        videoPath: z.string().min(1),
      }),
    ),
    finalVideoUrl: z.string().min(1),
    finalVideoPath: z.string().min(1).optional(),
  }),
  feedback: feedbackStateSchema,
});

const FEEDBACK_TRANSITIONS: Record<
  "video_ready" | "awaiting_feedback" | "creating_issues" | "done" | "failed",
  ReviewJobStatus[]
> = {
  video_ready: ["awaiting_feedback", "failed"],
  awaiting_feedback: ["creating_issues", "failed"],
  creating_issues: ["done", "failed"],
  done: [],
  failed: [],
};

export function createEmptyFeedbackState(): FeedbackState {
  return {
    conversation: { step: "idle" },
    findings: [],
    screenshotsByTimestamp: {},
    createdIssues: [],
  };
}

export function ensureReviewJobFeedbackDefaults(run: ReviewJob): ReviewJob {
  return {
    ...run,
    feedback: run.feedback ?? createEmptyFeedbackState(),
  };
}

export function derivePullRequestUrl(run: Pick<ReviewJob, "repo" | "pr">) {
  return `https://github.com/${run.repo.owner}/${run.repo.name}/pull/${run.pr.number}`;
}

export function normalizeRunForFeedback(run: ReviewJob): ReviewJob {
  const withDefaults = ensureReviewJobFeedbackDefaults(run);

  return {
    ...withDefaults,
    pr: {
      ...withDefaults.pr,
      url: withDefaults.pr.url ?? derivePullRequestUrl(withDefaults),
    },
  };
}

export function validateFeedbackReadyRun(run: ReviewJob) {
  const normalized = normalizeRunForFeedback(run);
  feedbackReadyRunSchema.parse(normalized);
  return normalized;
}

export function transitionFeedbackRun(run: ReviewJob, nextStatus: ReviewJobStatus): ReviewJob {
  const normalized = normalizeRunForFeedback(run);
  const currentStatus = normalized.status;

  if (!(currentStatus in FEEDBACK_TRANSITIONS)) {
    throw new Error(`Run ${normalized.id} is not in a feedback-agent state.`);
  }

  const allowed = FEEDBACK_TRANSITIONS[currentStatus as keyof typeof FEEDBACK_TRANSITIONS];

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Cannot transition feedback run from ${currentStatus} to ${nextStatus}.`);
  }

  return {
    ...normalized,
    status: nextStatus,
  };
}

type FakeRunOverrides = Partial<Omit<ReviewJob, "repo" | "pr" | "artifacts" | "feedback">> & {
  repo?: Partial<ReviewJob["repo"]>;
  pr?: Partial<ReviewJob["pr"]>;
  artifacts?: Partial<NonNullable<ReviewJob["artifacts"]>>;
  feedback?: Partial<NonNullable<ReviewJob["feedback"]>>;
};

export function buildFakeVideoReadyRun(overrides: FakeRunOverrides = {}): ReviewJob {
  const createdAt = "2026-03-21T10:00:00.000Z";
  const baseRun: ReviewJob = {
    id: randomUUID(),
    repo: {
      owner: "acme",
      name: "widget-web",
      cloneUrl: "https://github.com/acme/widget-web.git",
    },
    pr: {
      number: 42,
      title: "Polish the pricing page",
      body: "Improves hero layout and checkout states.",
      headRef: "feature/pricing-polish",
      baseRef: "main",
      headSha: "abc123",
      url: "https://github.com/acme/widget-web/pull/42",
    },
    changedFiles: [],
    runtime: {},
    status: "video_ready",
    tasks: [
      {
        id: "pricing-hero",
        title: "Review pricing hero and CTA flow",
        goal: "Confirm the pricing hero renders and the main CTA is visible.",
        startUrl: "/pricing",
        steps: ["Open pricing page", "Observe hero section", "Capture CTA state"],
        expected: ["Hero content is legible", "CTA is visible and enabled"],
        actions: [{ type: "goto", url: "/pricing" }],
      },
      {
        id: "checkout-summary",
        title: "Review checkout summary",
        goal: "Confirm the summary panel stays aligned on desktop.",
        startUrl: "/checkout",
        steps: ["Open checkout", "Inspect summary card"],
        expected: ["Summary remains aligned", "Price total is visible"],
        actions: [{ type: "goto", url: "/checkout" }],
      },
    ],
    createdAt,
    updatedAt: createdAt,
    workspaceDir: "/tmp/fake-review/workspace",
    outputDir: "/tmp/fake-review/output",
    logs: [],
    artifacts: {
      taskArtifacts: [],
      finalVideoUrl: "https://example.com/reviews/final-review.mp4",
      finalVideoPath: "/tmp/fake-review/output/final-review.mp4",
    },
    feedback: createEmptyFeedbackState(),
  };

  return normalizeRunForFeedback({
    ...baseRun,
    ...overrides,
    repo: { ...baseRun.repo, ...overrides.repo },
    pr: { ...baseRun.pr, ...overrides.pr },
    artifacts: {
      ...baseRun.artifacts,
      ...overrides.artifacts,
      taskArtifacts: overrides.artifacts?.taskArtifacts ?? baseRun.artifacts!.taskArtifacts,
    },
    feedback: {
      ...createEmptyFeedbackState(),
      ...overrides.feedback,
      conversation: overrides.feedback?.conversation ?? createEmptyFeedbackState().conversation,
      findings: overrides.feedback?.findings ?? [],
      screenshotsByTimestamp: overrides.feedback?.screenshotsByTimestamp ?? {},
      createdIssues: overrides.feedback?.createdIssues ?? [],
    },
  });
}
