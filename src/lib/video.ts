import path from "node:path";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { config } from "@/lib/config";
import { runCommand } from "@/lib/shell";
import { ensureDir } from "@/lib/fs-utils";
import type { QaTask, ReviewArtifact } from "@/lib/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function createIntroCard(input: {
  task: QaTask;
  artifact: ReviewArtifact;
  onLog: (message: string) => Promise<void>;
}) {
  const introImagePath = path.join(path.dirname(input.artifact.introCardPath), "intro.png");

  await input.onLog(`Creating intro card for task ${input.task.id}`);
  await renderIntroCardImage({
    imagePath: introImagePath,
    task: input.task,
  });
  await runCommand({
    command: config.ffmpegPath,
    args: [
      "-y",
      "-i",
      introImagePath,
      "-loop",
      "1",
      "-t",
      "4",
      "-vf",
      "fps=25,format=yuv420p",
      "-pix_fmt",
      "yuv420p",
      input.artifact.introCardPath,
    ],
    cwd: path.dirname(input.artifact.introCardPath),
    onOutput: (chunk) => void input.onLog(chunk.trim()).catch(() => {}),
  });
}

async function renderIntroCardImage(input: { imagePath: string; task: QaTask }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  const steps = input.task.steps
    .map((step, index) => `<li>${escapeHtml(`${index + 1}. ${step}`)}</li>`)
    .join("");

  await page.setContent(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            width: 1440px;
            height: 960px;
            background: #000;
            color: #fff;
            font-family: "SF Pro Display", "Segoe UI", sans-serif;
          }
          .frame {
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            padding: 88px 92px;
            display: flex;
            flex-direction: column;
            gap: 32px;
            background:
              radial-gradient(circle at top left, rgba(124, 244, 195, 0.15), transparent 28%),
              linear-gradient(180deg, #050505 0%, #000000 100%);
          }
          .eyebrow {
            color: #7cf4c3;
            font-size: 18px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            font-size: 56px;
            line-height: 1.05;
            max-width: 1100px;
          }
          ul {
            margin: 0;
            padding-left: 28px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            max-width: 1180px;
            font-size: 28px;
            line-height: 1.4;
            color: rgba(255, 255, 255, 0.9);
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <div class="eyebrow">QA Task</div>
          <h1>${escapeHtml(input.task.title)}</h1>
          <ul>${steps}</ul>
        </div>
      </body>
    </html>`,
  );

  await page.screenshot({
    path: input.imagePath,
  });
  await browser.close();
}

export async function stitchReviewVideo(input: {
  artifacts: ReviewArtifact[];
  outputDir: string;
  onLog: (message: string) => Promise<void>;
}) {
  await ensureDir(input.outputDir);
  const concatFilePath = path.join(input.outputDir, "concat.txt");
  const finalVideoPath = path.join(input.outputDir, "final-review.mp4");

  const concatContent = input.artifacts
    .flatMap((artifact) => [`file '${artifact.introCardPath}'`, `file '${artifact.videoPath}'`])
    .join("\n");

  await writeFile(concatFilePath, concatContent, "utf8");

  await input.onLog("Stitching final review video");
  await runCommand({
    command: config.ffmpegPath,
    args: [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFilePath,
      "-vf",
      "fps=25,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      finalVideoPath,
    ],
    cwd: input.outputDir,
    onOutput: (chunk) => void input.onLog(chunk.trim()).catch(() => {}),
  });

  return finalVideoPath;
}

export async function extractVideoScreenshot(input: {
  videoPathOrUrl: string;
  outputPath: string;
  timestampSeconds: number;
  onLog?: (message: string) => Promise<void>;
}) {
  await ensureDir(path.dirname(input.outputPath));
  await runCommand({
    command: config.ffmpegPath,
    args: [
      "-y",
      "-ss",
      String(input.timestampSeconds),
      "-i",
      input.videoPathOrUrl,
      "-frames:v",
      "1",
      "-update",
      "1",
      input.outputPath,
    ],
    cwd: path.dirname(input.outputPath),
    onOutput: (chunk) => void input.onLog?.(chunk.trim()).catch(() => {}),
  });

  return input.outputPath;
}
