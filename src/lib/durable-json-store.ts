import path from "node:path";
import { put, list } from "@vercel/blob";
import { config } from "@/lib/config";
import { ensureDir, pathExists, readJson, writeJson } from "@/lib/fs-utils";

type BlobListEntry = {
  downloadUrl: string;
  pathname: string;
};

function getLocalFilePath(storePath: string) {
  return path.join(config.jobsRootDir, storePath);
}

function normalizeStorePath(storePath: string) {
  return storePath.replace(/^\/+/, "");
}

async function listLocalJsonPaths(prefix: string) {
  const { readdir } = await import("node:fs/promises");
  const rootDirectory = getLocalFilePath(prefix);

  await ensureDir(rootDirectory);

  const walk = async (directory: string): Promise<string[]> => {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      const nested = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            return walk(fullPath);
          }

          if (!entry.isFile()) {
            return [];
          }

          return [path.relative(config.jobsRootDir, fullPath).split(path.sep).join(path.posix.sep)];
        }),
      );

      return nested.flat();
    } catch {
      return [];
    }
  };

  return walk(rootDirectory);
}

async function findBlobByPath(storePath: string): Promise<BlobListEntry | null> {
  const pathname = normalizeStorePath(storePath);
  const result = await list({
    prefix: pathname,
    token: config.blobToken,
  });

  const blob = result.blobs.find((entry) => entry.pathname === pathname);
  if (!blob) {
    return null;
  }

  return {
    pathname: blob.pathname,
    downloadUrl: blob.downloadUrl,
  };
}

export async function writeDurableJson(storePath: string, value: unknown) {
  const normalizedPath = normalizeStorePath(storePath);

  if (config.blobToken) {
    await put(normalizedPath, JSON.stringify(value, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json; charset=utf-8",
      token: config.blobToken,
    });
    return;
  }

  await writeJson(getLocalFilePath(normalizedPath), value);
}

export async function readDurableJson<T>(storePath: string): Promise<T | null> {
  const normalizedPath = normalizeStorePath(storePath);

  if (config.blobToken) {
    const blob = await findBlobByPath(normalizedPath);
    if (!blob) {
      return null;
    }

    const response = await fetch(blob.downloadUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  }

  const localFilePath = getLocalFilePath(normalizedPath);
  if (!(await pathExists(localFilePath))) {
    return null;
  }

  return readJson<T>(localFilePath);
}

export async function listDurableJsonPaths(prefix: string) {
  const normalizedPrefix = normalizeStorePath(prefix);

  if (config.blobToken) {
    const result = await list({
      prefix: normalizedPrefix,
      token: config.blobToken,
    });
    return result.blobs.map((entry) => entry.pathname);
  }

  return listLocalJsonPaths(normalizedPrefix);
}
