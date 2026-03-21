import path from "node:path";
import { access, constants, readFile, readdir } from "node:fs/promises";
import { ensureDir } from "@/lib/fs-utils";
import { runCommand } from "@/lib/shell";
import type { CommandSpec, ReviewJob } from "@/lib/types";

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

async function detectAppDirectory(workspaceDir: string, override?: string) {
  if (override) {
    return path.join(workspaceDir, override);
  }

  const candidates = ["frontend", "web", "app", "client", "."];

  for (const candidate of candidates) {
    const directory = candidate === "." ? workspaceDir : path.join(workspaceDir, candidate);
    const packageJson = await loadPackageJson(directory);
    if (packageJson) {
      return directory;
    }
  }

  const topLevelEntries = await readdir(workspaceDir, { withFileTypes: true });
  for (const entry of topLevelEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const nested = path.join(workspaceDir, entry.name);
    if (await fileExists(path.join(nested, "package.json"))) {
      return nested;
    }
  }

  return workspaceDir;
}

async function detectInstallCommand(appDir: string, override?: CommandSpec) {
  if (override) {
    return override;
  }

  const installCandidates = [
    { lockfile: "pnpm-lock.yaml", command: "pnpm", args: ["install", "--frozen-lockfile"] },
    { lockfile: "package-lock.json", command: "npm", args: ["install"] },
    { lockfile: "yarn.lock", command: "yarn", args: ["install", "--frozen-lockfile"] },
  ];

  const existence = await Promise.all(
    installCandidates.map(async (candidate) => ({
      ...candidate,
      exists: await fileExists(path.join(appDir, candidate.lockfile)),
    })),
  );

  return existence.find((candidate) => candidate.exists) ?? { command: "npm", args: ["install"] };
}

export async function prepareWorkspace(job: ReviewJob, onLog: (message: string) => Promise<void>) {
  await ensureDir(job.workspaceDir);
  await ensureDir(job.outputDir);

  await onLog(`Cloning ${job.repo.cloneUrl} into ${job.workspaceDir}`);
  await runCommand({
    command: "git",
    args: ["clone", job.repo.cloneUrl, job.workspaceDir],
    cwd: path.dirname(job.workspaceDir),
    onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
  });

  try {
    await onLog(`Fetching PR #${job.pr.number} head`);
    await runCommand({
      command: "git",
      args: ["fetch", "origin", `pull/${job.pr.number}/head:pr-${job.pr.number}`],
      cwd: job.workspaceDir,
      onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
    });

    await onLog(`Checking out pr-${job.pr.number}`);
    await runCommand({
      command: "git",
      args: ["checkout", `pr-${job.pr.number}`],
      cwd: job.workspaceDir,
      onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown git fetch error.";
    await onLog(`PR ref fetch failed, falling back to branch checkout: ${message}`);
    await onLog(`Checking out branch ${job.pr.headRef}`);
    await runCommand({
      command: "git",
      args: ["checkout", job.pr.headRef],
      cwd: job.workspaceDir,
      onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
    });
  }

  const appDir = await detectAppDirectory(job.workspaceDir, job.runtime.appDirectory);
  await onLog(`Detected app directory: ${path.relative(job.workspaceDir, appDir) || "."}`);
  const installCommand = await detectInstallCommand(appDir, job.runtime.installCommand);

  await installDependencies(appDir, installCommand, onLog);
  return { appDir };
}

async function installDependencies(
  workspaceDir: string,
  command: CommandSpec,
  onLog: (message: string) => Promise<void>,
) {
  await onLog(`Installing dependencies with ${command.command} ${command.args.join(" ")}`);
  await runCommand({
    command: command.command,
    args: command.args,
    cwd: workspaceDir,
    onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
  });
}
