import { spawn } from "node:child_process";
import path from "node:path";
import { access, constants } from "node:fs/promises";

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function detectStartCommand(workspaceDir: string) {
  const checks = [
    { file: "pnpm-lock.yaml", command: "pnpm", args: ["dev"] },
    { file: "package-lock.json", command: "npm", args: ["run", "dev"] },
    { file: "yarn.lock", command: "yarn", args: ["dev"] },
  ];

  return Promise.all(
    checks.map(async (check) => ({
      ...check,
      exists: await fileExists(path.join(workspaceDir, check.file)),
    })),
  ).then((results) => results.find((item) => item.exists) ?? { command: "npm", args: ["run", "dev"] });
}

async function waitForServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // server is not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for dev server at ${url}.`);
}

export async function startDevServer(input: {
  workspaceDir: string;
  baseUrl: string;
  onLog: (message: string) => Promise<void>;
}) {
  const { workspaceDir, baseUrl, onLog } = input;
  const url = new URL(baseUrl);
  const startCommand = await detectStartCommand(workspaceDir);

  await onLog(`Starting app with ${startCommand.command} ${startCommand.args.join(" ")}`);

  const child = spawn(startCommand.command, startCommand.args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      PORT: url.port || "3000",
      HOST: url.hostname,
      HOSTNAME: url.hostname,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    void onLog(`[app] ${String(chunk).trim()}`);
  });

  child.stderr.on("data", (chunk) => {
    void onLog(`[app] ${String(chunk).trim()}`);
  });

  child.on("error", (error) => {
    void onLog(`[app] failed: ${error.message}`);
  });

  await waitForServer(baseUrl, 120_000);

  return {
    stop: async () => {
      child.kill("SIGTERM");
    },
  };
}
