import path from "node:path";
import { ensureDir } from "@/lib/fs-utils";
import { launchChromium } from "@/lib/playwright-browser";
import type { QaAction, QaTask, ReviewArtifact } from "@/lib/types";
import type { Page } from "playwright";

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

export async function runQaTask(input: {
  task: QaTask;
  baseUrl: string;
  outputDir: string;
}): Promise<ReviewArtifact> {
  const taskOutputDir = path.join(input.outputDir, input.task.id);
  await ensureDir(taskOutputDir);

  const browser = await launchChromium({ headless: true });
  const context = await browser.newContext({
    baseURL: input.baseUrl,
    viewport: { width: 1440, height: 960 },
    recordVideo: {
      dir: taskOutputDir,
      size: { width: 1440, height: 960 },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  let videoPath = "";

  try {
    for (const action of input.task.actions) {
      await runAction(page, action, taskOutputDir);
    }
  } catch (error) {
    await page.screenshot({
      path: path.join(taskOutputDir, "failure-state.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
    videoPath = (await video?.path()) ?? "";
    await browser.close();
  }

  return {
    taskId: input.task.id,
    introCardPath: path.join(taskOutputDir, "intro.mp4"),
    videoPath,
  };
}
