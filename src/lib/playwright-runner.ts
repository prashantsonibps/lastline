import path from "node:path";
import { access, constants, writeFile } from "node:fs/promises";
import { ensureDir } from "@/lib/fs-utils";
import { config } from "@/lib/config";
import { launchChromium } from "@/lib/playwright-browser";
import { runCommand } from "@/lib/shell";
import type { QaAction, QaTask, ReviewArtifact } from "@/lib/types";
import type { Page } from "playwright";

function shouldUsePlaywrightVideoRecording() {
  return !(process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT);
}

async function runAction(page: Page, action: QaAction, taskOutputDir: string) {
  switch (action.type) {
    case "goto":
      await page.goto(action.url.trim(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      return;
    case "click":
      await page.locator(action.selector).first().click();
      return;
    case "fill":
      await page.locator(action.selector).first().fill(action.value);
      return;
    case "press":
      await page.locator(action.selector).first().press(action.key);
      return;
    case "waitForSelector":
      await page.locator(action.selector).first().waitFor({ state: "visible" });
      return;
    case "waitForText":
      await page.getByText(action.text, { exact: false }).first().waitFor();
      return;
    case "screenshot":
      await page.screenshot({
        path: path.join(taskOutputDir, `${action.name}.png`),
        fullPage: true,
      });
      return;
    case "sleep":
      await page.waitForTimeout(action.ms);
      return;
  }
}

async function captureTaskFrame(page: Page, framesDir: string, frameIndex: number) {
  const framePath = path.join(framesDir, `${String(frameIndex).padStart(4, "0")}.png`);
  await page.screenshot({
    path: framePath,
    fullPage: false,
    animations: "disabled",
  });
}

async function createSyntheticTaskVideo(input: {
  framesDir: string;
  outputPath: string;
  onLog?: (message: string) => Promise<void>;
}) {
  const concatFilePath = path.join(input.framesDir, "frames.txt");
  const existingFrames: string[] = [];

  for (let index = 0; ; index += 1) {
    const framePath = path.join(input.framesDir, `${String(index).padStart(4, "0")}.png`);
    try {
      await access(framePath, constants.F_OK);
      existingFrames.push(framePath);
    } catch {
      break;
    }
  }

  if (existingFrames.length === 0) {
    throw new Error("No screenshots were captured for this QA task.");
  }

  const concatContent = existingFrames
    .flatMap((framePath, index) => {
      const lines = [`file '${framePath.replaceAll("'", "'\\''")}'`];
      if (index < existingFrames.length - 1) {
        lines.push("duration 1.2");
      }
      return lines;
    })
    .join("\n");

  await writeFile(concatFilePath, concatContent, "utf8");
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
      "fps=25,scale=1440:960:force_original_aspect_ratio=decrease,pad=1440:960:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
    cwd: input.framesDir,
    onOutput: (chunk) => void input.onLog?.(chunk.trim()).catch(() => {}),
  });
}

export async function runQaTask(input: {
  task: QaTask;
  baseUrl: string;
  outputDir: string;
  onLog?: (message: string) => Promise<void>;
}): Promise<ReviewArtifact> {
  const taskOutputDir = path.join(input.outputDir, input.task.id);
  const framesDir = path.join(taskOutputDir, "frames");
  await ensureDir(taskOutputDir);
  await ensureDir(framesDir);

  const useRecordedVideo = shouldUsePlaywrightVideoRecording();
  const browser = await launchChromium({ headless: true });
  const context = await browser.newContext(
    useRecordedVideo
      ? {
          baseURL: input.baseUrl,
          viewport: { width: 1440, height: 960 },
          recordVideo: {
            dir: taskOutputDir,
            size: { width: 1440, height: 960 },
          },
        }
      : {
          baseURL: input.baseUrl,
          viewport: { width: 1440, height: 960 },
        },
  );
  const page = await context.newPage();
  const video = useRecordedVideo ? page.video() : null;
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  let videoPath = path.join(taskOutputDir, "task.mp4");
  let frameIndex = 0;

  try {
    for (const action of input.task.actions) {
      await runAction(page, action, taskOutputDir);
      if (!useRecordedVideo) {
        await captureTaskFrame(page, framesDir, frameIndex);
        frameIndex += 1;
      }
    }
  } catch (error) {
    await page.screenshot({
      path: path.join(taskOutputDir, "failure-state.png"),
      fullPage: true,
    });
    if (!useRecordedVideo) {
      await captureTaskFrame(page, framesDir, frameIndex);
    }
    throw error;
  } finally {
    await context.close();
    if (useRecordedVideo) {
      videoPath = (await video?.path()) ?? videoPath;
    } else {
      await createSyntheticTaskVideo({
        framesDir,
        outputPath: videoPath,
        onLog: input.onLog,
      });
    }
    await browser.close();
  }

  return {
    taskId: input.task.id,
    introCardPath: path.join(taskOutputDir, "intro.mp4"),
    videoPath,
  };
}
