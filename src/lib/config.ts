import path from "node:path";

const rootDir = process.cwd();

export const config = {
  rootDir,
  jobsRootDir: path.join(rootDir, ".review-jobs"),
  appPort: Number(process.env.APP_PORT ?? "3000"),
  reviewAppBaseUrl: process.env.REVIEW_APP_BASE_URL ?? "http://127.0.0.1:3100",
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  githubToken: process.env.GITHUB_TOKEN,
  googleApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  qaModel: process.env.GEMINI_QA_MODEL ?? "gemini-2.5-pro",
  feedbackModel: process.env.GEMINI_FEEDBACK_MODEL ?? process.env.GEMINI_QA_MODEL ?? "gemini-2.5-pro",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  telegramDefaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID,
} as const;
