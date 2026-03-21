import path from "node:path";
import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import { config } from "@/lib/config";
import type { VideoArtifact } from "@/lib/types";

export async function uploadFinalVideoArtifact(input: {
  filePath: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;
  jobId: string;
}) {
  return uploadArtifact({
    filePath: input.filePath,
    blobPath: [
      "reviews",
      sanitizePathSegment(input.repoOwner),
      sanitizePathSegment(input.repoName),
      `pr-${input.prNumber}`,
      input.jobId,
      path.basename(input.filePath),
    ].join("/"),
    contentType: "video/mp4",
  });
}

export async function uploadScreenshotArtifact(input: {
  filePath: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;
  jobId: string;
  screenshotName: string;
}) {
  return uploadArtifact({
    filePath: input.filePath,
    blobPath: [
      "reviews",
      sanitizePathSegment(input.repoOwner),
      sanitizePathSegment(input.repoName),
      `pr-${input.prNumber}`,
      input.jobId,
      "screenshots",
      `${sanitizePathSegment(input.screenshotName)}.png`,
    ].join("/"),
    contentType: "image/png",
  });
}

async function uploadArtifact(input: {
  filePath: string;
  blobPath: string;
  contentType: string;
}) {
  if (!config.blobToken) {
    return null;
  }

  const file = await readFile(input.filePath);

  const result = await put(input.blobPath, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: input.contentType,
    token: config.blobToken,
  });

  return {
    kind: "remote_url",
    location: result.url,
    isDurable: true,
  } satisfies VideoArtifact;
}

function sanitizePathSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
