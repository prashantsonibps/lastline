import path from "node:path";
import { access, constants } from "node:fs/promises";
import { ensureDir } from "@/lib/fs-utils";
import { runCommand } from "@/lib/shell";
import type { ReviewJob } from "@/lib/types";

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
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

  await installDependencies(job.workspaceDir, onLog);
}

async function installDependencies(workspaceDir: string, onLog: (message: string) => Promise<void>) {
  const installCandidates = [
    { lockfile: "pnpm-lock.yaml", command: "pnpm", args: ["install", "--frozen-lockfile"] },
    { lockfile: "package-lock.json", command: "npm", args: ["install"] },
    { lockfile: "yarn.lock", command: "yarn", args: ["install", "--frozen-lockfile"] },
  ];

  const existence = await Promise.all(
    installCandidates.map(async (candidate) => ({
      ...candidate,
      exists: await fileExists(path.join(workspaceDir, candidate.lockfile)),
    })),
  );

  const preferred = existence.find((candidate) => candidate.exists);

  const command = preferred ?? { command: "npm", args: ["install"] };

  await onLog(`Installing dependencies with ${command.command} ${command.args.join(" ")}`);
  await runCommand({
    command: command.command,
    args: command.args,
    cwd: workspaceDir,
    onOutput: (chunk) => void onLog(chunk.trim()).catch(() => {}),
  });
}
