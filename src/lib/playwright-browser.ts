import path from "node:path";
import { access, constants, readdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listBrowserDirectories(rootDir: string) {
  if (!(await fileExists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(rootDir, entry.name));
}

async function resolveBundledChromiumExecutable() {
  const playwrightCoreRoot = path.dirname(require.resolve("playwright-core/package.json"));
  const bundledBrowserRoot = path.join(playwrightCoreRoot, ".local-browsers");
  const browserDirectories = await listBrowserDirectories(bundledBrowserRoot);

  const candidateRelativePaths = [
    path.join("chrome-headless-shell-linux64", "chrome-headless-shell"),
    path.join("chrome-linux", "chrome"),
    path.join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
    path.join("chrome-win", "chrome.exe"),
  ];

  for (const browserDirectory of browserDirectories) {
    for (const candidate of candidateRelativePaths) {
      const executablePath = path.join(browserDirectory, candidate);
      if (await fileExists(executablePath)) {
        return executablePath;
      }
    }
  }

  return null;
}

export async function launchChromium(options: { headless?: boolean } = {}) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";

  const { chromium } = await import("playwright");
  const executablePath = await resolveBundledChromiumExecutable();

  if (executablePath) {
    return chromium.launch({
      ...options,
      executablePath,
    });
  }

  return chromium.launch(options);
}
