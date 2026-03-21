import { randomUUID } from "node:crypto";
import type {
  CreatedIssueRef,
  FeedbackFinding,
  ReviewJob,
  ScreenshotArtifact,
  TelegramActionId,
} from "../types.ts";
import {
  normalizeRunForFeedback,
  transitionFeedbackRun,
  validateFeedbackReadyRun,
} from "./contract.ts";
import { formatTimestamp, normalizeTimestampToSeconds } from "./timestamps.ts";

export type TelegramAction = {
  id: TelegramActionId;
  label: string;
};

export type TelegramAdapter = {
  sendReview(input: {
    chatId: string;
    threadId?: string;
    summary: string;
    videoUrl: string;
    actions: TelegramAction[];
  }): Promise<{ messageId: string; threadId?: string }>;
  sendMessage(input: {
    chatId: string;
    threadId?: string;
    text: string;
    actions?: TelegramAction[];
  }): Promise<{ messageId: string }>;
};

export type ScreenshotAdapter = {
  extractScreenshot(input: {
    run: ReviewJob;
    timestampSeconds: number;
  }): Promise<ScreenshotArtifact>;
};

export type IssueDraft = {
  title: string;
  observedBehavior: string;
  expectedBehavior: string;
};

export type IssueDraftingAdapter = {
  draftIssue(input: {
    run: ReviewJob;
    finding: FeedbackFinding;
  }): Promise<IssueDraft>;
};

export type GitHubIssuesAdapter = {
  createIssue(input: {
    run: ReviewJob;
    finding: FeedbackFinding;
    title: string;
    body: string;
  }): Promise<{ issueNumber: number; issueUrl: string }>;
};

export type TelegramEvent =
  | {
      type: "callback";
      chatId: string;
      action: TelegramActionId;
    }
  | {
      type: "message";
      chatId: string;
      text: string;
    };

export function formatReviewSummary(run: ReviewJob) {
  const normalized = validateFeedbackReadyRun(run);
  const taskLines = normalized.tasks.map((task, index) => `${index + 1}. ${task.title}`).join("\n");

  return [
    `PR Review Ready: #${normalized.pr.number} ${normalized.pr.title}`,
    `${normalized.repo.owner}/${normalized.repo.name}`,
    `PR: ${normalized.pr.url}`,
    "",
    "What was tested:",
    taskLines,
    "",
    "Use the buttons below to report a bug or create issues after you finish reviewing.",
  ].join("\n");
}

function feedbackActions(includeAddAnother = false): TelegramAction[] {
  const actions: TelegramAction[] = [{ id: "report_bug", label: "Report bug" }];

  if (includeAddAnother) {
    actions.push({ id: "add_another", label: "Add another finding" });
  }

  actions.push({ id: "create_issues", label: "Create issues" });
  return actions;
}

function assertTelegramBinding(run: ReviewJob, chatId: string) {
  const binding = run.feedback?.telegram;

  if (!binding) {
    throw new Error(`Run ${run.id} has not been delivered to Telegram yet.`);
  }

  if (binding.chatId !== chatId) {
    throw new Error(`Telegram chat ${chatId} is not bound to run ${run.id}.`);
  }

  return binding;
}

function applyScreenshot(run: ReviewJob, findingId: string, screenshot: ScreenshotArtifact) {
  const updated: ReviewJob = {
    ...run,
    feedback: {
      ...run.feedback!,
      screenshotsByTimestamp: {
        ...run.feedback!.screenshotsByTimestamp,
        [String(screenshot.timestampSeconds)]: screenshot,
      },
      findings: run.feedback!.findings.map((finding) =>
        finding.id === findingId
          ? {
              ...finding,
              screenshot,
            }
          : finding,
      ),
    },
  };

  return updated;
}

export function renderIssueBody(input: {
  run: ReviewJob;
  finding: FeedbackFinding;
  draft: IssueDraft;
}) {
  const screenshotLine =
    input.finding.screenshot?.status === "ready" && input.finding.screenshot.assetUrl
      ? input.finding.screenshot.assetUrl
      : input.finding.screenshot?.error ?? "Screenshot unavailable.";

  return [
    "## Report Origin",
    "Feedback agent review",
    "",
    "## Timestamp",
    `${formatTimestamp(input.finding.timestampSeconds)} (${input.finding.timestampSeconds}s)`,
    "",
    "## PR",
    input.run.pr.url ?? "",
    "",
    "## Observed Behavior",
    input.draft.observedBehavior,
    "",
    "## Expected Behavior",
    input.draft.expectedBehavior,
    "",
    "## Original User Note",
    input.finding.description,
    "",
    "## Screenshot",
    screenshotLine,
    "",
    "## Full Review Video",
    input.run.artifacts?.finalVideoUrl ?? "",
  ].join("\n");
}

export function createFeedbackAgent(deps: {
  telegram: TelegramAdapter;
  screenshots: ScreenshotAdapter;
  issueDrafting: IssueDraftingAdapter;
  github: GitHubIssuesAdapter;
}) {
  return {
    async startFeedbackForRun(input: {
      run: ReviewJob;
      chatId: string;
      threadId?: string;
    }): Promise<ReviewJob> {
      const run = validateFeedbackReadyRun(input.run);
      const summary = formatReviewSummary(run);
      const videoUrl = run.artifacts?.finalVideoUrl;

      if (!videoUrl) {
        throw new Error(`Run ${run.id} is missing the stitched review video reference.`);
      }

      const delivery = await deps.telegram.sendReview({
        chatId: input.chatId,
        threadId: input.threadId,
        summary,
        videoUrl,
        actions: feedbackActions(),
      });

      const updated: ReviewJob = {
        ...run,
        feedback: {
          ...run.feedback!,
          delivery: {
            deliveredAt: new Date().toISOString(),
            summary,
            videoUrl,
          },
          telegram: {
            chatId: input.chatId,
            deliveryMessageId: delivery.messageId,
            threadId: delivery.threadId ?? input.threadId,
          },
          conversation: { step: "idle" },
        },
      };

      return transitionFeedbackRun(updated, "awaiting_feedback");
    },

    async handleTelegramEvent(input: {
      run: ReviewJob;
      event: TelegramEvent;
    }): Promise<ReviewJob> {
      const run = normalizeRunForFeedback(input.run);
      const binding = assertTelegramBinding(run, input.event.chatId);

      if (input.event.type === "callback") {
        if (input.event.action === "create_issues") {
          if (run.feedback!.findings.length === 0) {
            const prompt = await deps.telegram.sendMessage({
              chatId: binding.chatId,
              threadId: binding.threadId,
              text: "Add at least one finding before creating issues. Tap Report bug to start.",
              actions: feedbackActions(),
            });

            const updated: ReviewJob = {
              ...run,
              feedback: {
                ...run.feedback!,
                telegram: {
                  ...binding,
                  lastPromptMessageId: prompt.messageId,
                },
              },
            };

            return updated;
          }

          return this.createIssuesForRun({ run });
        }

        const prompt = await deps.telegram.sendMessage({
          chatId: binding.chatId,
          threadId: binding.threadId,
          text: "Send the timestamp for the issue you spotted. Formats like 75, 1:15, or 00:01:15 all work.",
        });

        const updated: ReviewJob = {
          ...run,
          feedback: {
            ...run.feedback!,
            conversation: { step: "awaiting_timestamp" },
            telegram: {
              ...binding,
              lastPromptMessageId: prompt.messageId,
            },
          },
        };

        return updated;
      }

      if (run.feedback!.conversation.step === "awaiting_timestamp") {
        try {
          const timestampSeconds = normalizeTimestampToSeconds(input.event.text);
          const prompt = await deps.telegram.sendMessage({
            chatId: binding.chatId,
            threadId: binding.threadId,
            text: `Saved timestamp ${formatTimestamp(timestampSeconds)}. Now describe the issue you saw.`,
          });

          const updated: ReviewJob = {
            ...run,
            feedback: {
              ...run.feedback!,
              conversation: {
                step: "awaiting_description",
                timestampInput: input.event.text.trim(),
                timestampSeconds,
              },
              telegram: {
                ...binding,
                lastPromptMessageId: prompt.messageId,
              },
            },
          };

          return updated;
        } catch (error) {
          const prompt = await deps.telegram.sendMessage({
            chatId: binding.chatId,
            threadId: binding.threadId,
            text:
              error instanceof Error
                ? `${error.message} Please reply with a timestamp before we save the finding.`
                : "Please reply with a valid timestamp before we save the finding.",
          });

          const updated: ReviewJob = {
            ...run,
            feedback: {
              ...run.feedback!,
              telegram: {
                ...binding,
                lastPromptMessageId: prompt.messageId,
              },
            },
          };

          return updated;
        }
      }

      if (run.feedback!.conversation.step === "awaiting_description") {
        const finding: FeedbackFinding = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          timestampInput: run.feedback!.conversation.timestampInput,
          timestampSeconds: run.feedback!.conversation.timestampSeconds,
          description: input.event.text.trim(),
        };

        const prompt = await deps.telegram.sendMessage({
          chatId: binding.chatId,
          threadId: binding.threadId,
          text: `Saved your finding at ${formatTimestamp(finding.timestampSeconds)}.`,
          actions: feedbackActions(true),
        });

        const updated: ReviewJob = {
          ...run,
          feedback: {
            ...run.feedback!,
            conversation: { step: "idle" },
            findings: [...run.feedback!.findings, finding],
            telegram: {
              ...binding,
              lastPromptMessageId: prompt.messageId,
            },
          },
        };

        return updated;
      }

      const prompt = await deps.telegram.sendMessage({
        chatId: binding.chatId,
        threadId: binding.threadId,
        text: "Tap Report bug to start a guided finding.",
        actions: feedbackActions(run.feedback!.findings.length > 0),
      });

      const updated: ReviewJob = {
        ...run,
        feedback: {
          ...run.feedback!,
          telegram: {
            ...binding,
            lastPromptMessageId: prompt.messageId,
          },
        },
      };

      return updated;
    },

    async createIssuesForRun(input: {
      run: ReviewJob;
    }): Promise<ReviewJob> {
      let run: ReviewJob = transitionFeedbackRun(normalizeRunForFeedback(input.run), "creating_issues");

      for (const finding of run.feedback!.findings) {
        const screenshotKey = String(finding.timestampSeconds);
        let screenshot = run.feedback!.screenshotsByTimestamp[screenshotKey];

        if (!screenshot) {
          screenshot = await deps.screenshots.extractScreenshot({
            run,
            timestampSeconds: finding.timestampSeconds,
          });
          run = applyScreenshot(run, finding.id, screenshot);
        } else {
          run = applyScreenshot(run, finding.id, screenshot);
        }

        const updatedFinding = run.feedback!.findings.find((entry) => entry.id === finding.id)!;
        const draft = await deps.issueDrafting.draftIssue({
          run,
          finding: updatedFinding,
        });
        const issue = await deps.github.createIssue({
          run,
          finding: updatedFinding,
          title: draft.title,
          body: renderIssueBody({
            run,
            finding: updatedFinding,
            draft,
          }),
        });

        const issueRef: CreatedIssueRef = {
          findingId: updatedFinding.id,
          issueNumber: issue.issueNumber,
          issueUrl: issue.issueUrl,
          title: draft.title,
        };

        run = {
          ...run,
          feedback: {
            ...run.feedback!,
            findings: run.feedback!.findings.map((entry) =>
              entry.id === updatedFinding.id
                ? {
                    ...entry,
                    issue: issueRef,
                  }
                : entry,
            ),
            createdIssues: [...run.feedback!.createdIssues, issueRef],
          },
        };
      }

      const doneRun = transitionFeedbackRun(run, "done");
      const binding = doneRun.feedback!.telegram;

      if (binding) {
        await deps.telegram.sendMessage({
          chatId: binding.chatId,
          threadId: binding.threadId,
          text: `Created ${doneRun.feedback!.createdIssues.length} GitHub issue(s) from this review.`,
        });
      }

      return doneRun;
    },
  };
}
