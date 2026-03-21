import path from "node:path";
import { writeFile } from "node:fs/promises";
import { config } from "@/lib/config";
import { runCommand } from "@/lib/shell";
import { ensureDir } from "@/lib/fs-utils";
import type { QaTask, ReviewArtifact } from "@/lib/types";

function escapeDrawText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function createIntroCard(input: {
  task: QaTask;
  artifact: ReviewArtifact;
  onLog: (message: string) => Promise<void>;
}) {
  const textLines = [input.task.title, ...input.task.steps.map((step, index) => `${index + 1}. ${step}`)];
  const drawtext = textLines
    .map(
      (line, index) =>
        `drawtext=text='${escapeDrawText(line)}':fontcolor=white:fontsize=${index === 0 ? 42 : 28}:x=80:y=${120 + index * 64}`,
    )
    .join(",");

  await input.onLog(`Creating intro card for task ${input.task.id}`);
  await runCommand({
    command: config.ffmpegPath,
    args: [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=1440x960:d=4",
      "-vf",
      drawtext,
      "-pix_fmt",
      "yuv420p",
      input.artifact.introCardPath,
    ],
    cwd: path.dirname(input.artifact.introCardPath),
    onOutput: (chunk) => void input.onLog(chunk.trim()).catch(() => {}),
  });
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
      "-c",
      "copy",
      finalVideoPath,
    ],
    cwd: input.outputDir,
    onOutput: (chunk) => void input.onLog(chunk.trim()).catch(() => {}),
  });

  return finalVideoPath;
}

