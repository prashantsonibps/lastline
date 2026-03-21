function isServerlessChromiumRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT);
}

export async function launchChromium(options: { headless?: boolean } = {}) {
  const { chromium } = await import("playwright");

  if (isServerlessChromiumRuntime()) {
    const chromiumModule = await import("@sparticuz/chromium");
    const serverlessChromium = chromiumModule.default;
    serverlessChromium.setGraphicsMode = false;

    return chromium.launch({
      ...options,
      args: [...serverlessChromium.args],
      executablePath: await serverlessChromium.executablePath(),
    });
  }

  return chromium.launch(options);
}
