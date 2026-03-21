import path from "node:path";

const rootDir = process.cwd();
const defaultJobsRootDir = process.env.VERCEL
  ? path.join("/tmp", "lastline-review-jobs")
  : path.join(rootDir, ".review-jobs");

export const config = {
  rootDir,
  jobsRootDir: process.env.JOBS_ROOT_DIR ?? defaultJobsRootDir,
  chatStateDir: path.join(process.env.JOBS_ROOT_DIR ?? defaultJobsRootDir, "_chat"),
  appPort: Number(process.env.APP_PORT ?? "3000"),
  reviewAppBaseUrl: process.env.REVIEW_APP_BASE_URL ?? "http://127.0.0.1:3100",
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY,
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  githubToken: process.env.GITHUB_TOKEN,
  googleApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  qaModel: process.env.GEMINI_QA_MODEL ?? process.env.REVIEW_QA_MODEL ?? "google/gemini-3.1-pro-preview",
  feedbackModel:
    process.env.GEMINI_FEEDBACK_MODEL ?? process.env.GEMINI_QA_MODEL ?? "google/gemini-3.1-pro-preview",
  reviewAssistantModel: process.env.REVIEW_ASSISTANT_MODEL ?? "google/gemini-3.1-pro-preview",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME,
  telegramDefaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID,
} as const;
