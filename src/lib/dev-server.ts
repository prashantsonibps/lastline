import { spawn } from "node:child_process";
import path from "node:path";
import { access, constants, readFile } from "node:fs/promises";
import type { CommandSpec, ReviewRuntimeConfig } from "@/lib/types";

type PackageJson = {
  scripts?: Record<string, string>;
};

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadPackageJson(dirPath: string) {
  const packageJsonPath = path.join(dirPath, "package.json");

  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;
}

async function detectStartCommand(workspaceDir: string, override?: CommandSpec) {
  if (override) {
    return override;
  }

  const packageJson = await loadPackageJson(workspaceDir);
  const scripts = packageJson?.scripts ?? {};

  if ("dev" in scripts) {
    if (await fileExists(path.join(workspaceDir, "pnpm-lock.yaml"))) {
      return { command: "pnpm", args: ["dev"] };
    }

    if (await fileExists(path.join(workspaceDir, "yarn.lock"))) {
      return { command: "yarn", args: ["dev"] };
    }

    return { command: "npm", args: ["run", "dev"] };
  }

  if ("start" in scripts) {
    if (await fileExists(path.join(workspaceDir, "pnpm-lock.yaml"))) {
      return { command: "pnpm", args: ["start"] };
    }

    if (await fileExists(path.join(workspaceDir, "yarn.lock"))) {
      return { command: "yarn", args: ["start"] };
    }

    return { command: "npm", args: ["run", "start"] };
  }

  return { command: "npm", args: ["run", "dev"] };
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
  appDir: string;
  baseUrl: string;
  runtime: ReviewRuntimeConfig;
  onLog: (message: string) => Promise<void>;
}) {
  const { appDir, baseUrl, onLog, runtime } = input;
  const url = new URL(baseUrl);
  const startCommand = await detectStartCommand(appDir, runtime.startCommand);

  await onLog(`Starting app with ${startCommand.command} ${startCommand.args.join(" ")}`);

  const child = spawn(startCommand.command, startCommand.args, {
    cwd: appDir,
    env: {
      ...process.env,
      ...runtime.env,
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

  await waitForServer(baseUrl, runtime.startTimeoutMs ?? 120_000);

  return {
    stop: async () => {
      child.kill("SIGTERM");
    },
  };
}
