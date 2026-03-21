import path from "node:path";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { config } from "../config.ts";
import { ensureDir } from "../fs-utils.ts";
import { runCommand } from "../shell.ts";
import type { ReviewJob } from "../types.ts";
import type {
  GitHubIssuesAdapter,
  IssueDraftingAdapter,
  ScreenshotAdapter,
  TelegramAdapter,
} from "./service.ts";

function createInlineKeyboard(actions?: { id: string; label: string }[]) {
  if (!actions || actions.length === 0) {
    return undefined;
  }

  return {
    inline_keyboard: [actions.map((action) => ({ text: action.label, callback_data: action.id }))],
  };
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for Telegram delivery.");
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Telegram API returned ${response.status} for ${method}.`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result?: {
      message_id: number;
      message_thread_id?: number;
    };
  };

  if (!payload.ok || !payload.result) {
    throw new Error(`Telegram API call ${method} did not return a message result.`);
  }

  return payload.result;
}

export function createTelegramBotAdapter(): TelegramAdapter {
  return {
    async sendReview(input) {
      const result = await telegramRequest("sendVideo", {
        chat_id: input.chatId,
        message_thread_id: input.threadId ? Number(input.threadId) : undefined,
        video: input.videoUrl,
        caption: input.summary,
        reply_markup: createInlineKeyboard(input.actions),
      });

      return {
        messageId: String(result.message_id),
        threadId: result.message_thread_id ? String(result.message_thread_id) : input.threadId,
      };
    },

    async sendMessage(input) {
      const result = await telegramRequest("sendMessage", {
        chat_id: input.chatId,
        message_thread_id: input.threadId ? Number(input.threadId) : undefined,
        text: input.text,
        reply_markup: createInlineKeyboard(input.actions),
      });

      return {
        messageId: String(result.message_id),
      };
    },
  };
}

export function createFfmpegScreenshotAdapter(): ScreenshotAdapter {
  return {
    async extractScreenshot(input) {
      const videoSource = input.run.artifacts?.finalVideoPath ?? input.run.artifacts?.finalVideoUrl;

      if (!videoSource) {
        return {
          timestampSeconds: input.timestampSeconds,
          status: "failed",
          error: "No stitched video artifact was available for screenshot extraction.",
        };
      }

      const screenshotDir = path.join(input.run.outputDir, "feedback-screenshots");
      const screenshotPath = path.join(screenshotDir, `${input.timestampSeconds}.png`);

      try {
        await ensureDir(screenshotDir);
        await runCommand({
          command: config.ffmpegPath,
          args: [
            "-y",
            "-ss",
            String(input.timestampSeconds),
            "-i",
            videoSource,
            "-frames:v",
            "1",
            screenshotPath,
          ],
          cwd: input.run.outputDir,
        });

        return {
          timestampSeconds: input.timestampSeconds,
          status: "ready",
          assetUrl: screenshotPath,
        };
      } catch (error) {
        return {
          timestampSeconds: input.timestampSeconds,
          status: "failed",
          error: error instanceof Error ? error.message : "Screenshot extraction failed.",
        };
      }
    },
  };
}

const issueDraftSchema = z.object({
  title: z.string().min(1),
  observedBehavior: z.string().min(1),
  expectedBehavior: z.string().min(1),
});

export function createIssueDraftingAdapter(): IssueDraftingAdapter {
  return {
    async draftIssue(input) {
      if (!config.googleApiKey) {
        return {
          title: `Bug at ${input.finding.timestampInput}: ${input.finding.description.slice(0, 60)}`,
          observedBehavior: input.finding.description,
          expectedBehavior: "The reviewed experience should behave as intended without this issue.",
        };
      }

      const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey });
      const { object } = await generateObject({
        model: google(config.feedbackModel),
        schema: issueDraftSchema,
        temperature: 0.2,
        system:
          "You convert raw UI bug notes into precise GitHub issue fields. Preserve the user meaning and keep the output concise.",
        prompt: [
          `Repository: ${input.run.repo.owner}/${input.run.repo.name}`,
          `PR: ${input.run.pr.title}`,
          `Timestamp: ${input.finding.timestampInput}`,
          `Original note: ${input.finding.description}`,
        ].join("\n"),
      });

      return object;
    },
  };
}

export function createGitHubIssuesAdapter(): GitHubIssuesAdapter {
  return {
    async createIssue(input) {
      if (!config.githubToken) {
        const issueNumber = input.run.feedback!.createdIssues.length + 1;
        return {
          issueNumber,
          issueUrl: `${input.run.pr.url}#issue-simulated-${issueNumber}`,
        };
      }

      const response = await fetch(
        `https://api.github.com/repos/${input.run.repo.owner}/${input.run.repo.name}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "lastline-feedback-agent",
          },
          body: JSON.stringify({
            title: input.title,
            body: input.body,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`GitHub issue creation failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        number: number;
        html_url: string;
      };

      return {
        issueNumber: payload.number,
        issueUrl: payload.html_url,
      };
    },
  };
}

export function createDefaultFeedbackAgentDependencies() {
  return {
    telegram: createTelegramBotAdapter(),
    screenshots: createFfmpegScreenshotAdapter(),
    issueDrafting: createIssueDraftingAdapter(),
    github: createGitHubIssuesAdapter(),
  };
}

export function resolveTelegramChatId(run: ReviewJob) {
  return run.feedback?.telegram?.chatId ?? config.telegramDefaultChatId;
}
