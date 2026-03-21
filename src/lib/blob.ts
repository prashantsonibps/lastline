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
  if (!config.blobToken) {
    return null;
  }

  const file = await readFile(input.filePath);
  const blobPath = [
    "reviews",
    sanitizePathSegment(input.repoOwner),
    sanitizePathSegment(input.repoName),
    `pr-${input.prNumber}`,
    input.jobId,
    path.basename(input.filePath),
  ].join("/");

  const result = await put(blobPath, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: "video/mp4",
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

