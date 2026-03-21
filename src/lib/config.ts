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
  openaiApiKey: process.env.OPENAI_API_KEY,
  qaModel: process.env.OPENAI_QA_MODEL ?? "gpt-4.1",
} as const;
