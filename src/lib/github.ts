import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { createManualReviewJob } from "@/lib/review-jobs-store";

const pullRequestEventSchema = z.object({
  action: z.string(),
  repository: z.object({
    name: z.string(),
    clone_url: z.string().url(),
    html_url: z.string().url().optional(),
    default_branch: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }),
  pull_request: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string().url().optional(),
    head: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
    base: z.object({
      ref: z.string(),
    }),
  }),
});

type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;

const RELEVANT_PR_ACTIONS = new Set(["opened", "reopened", "synchronize", "ready_for_review"]);

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!config.githubWebhookSecret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", config.githubWebhookSecret).update(rawBody).digest("hex")}`;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function parseWebhookEvent(eventName: string | null, rawBody: string) {
  if (eventName !== "pull_request") {
    return null;
  }

  const parsed = pullRequestEventSchema.parse(JSON.parse(rawBody));

  if (!RELEVANT_PR_ACTIONS.has(parsed.action)) {
    return null;
  }

  return parsed;
}

async function fetchPullRequestFiles(event: PullRequestEvent) {
  if (!config.githubToken) {
    return [];
  }

  const url = `https://api.github.com/repos/${event.repository.owner.login}/${event.repository.name}/pulls/${event.pull_request.number}/files`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "lastline-review-agent",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch pull request files. GitHub returned ${response.status}.`);
  }

  const fileSchema = z.array(
    z.object({
      filename: z.string(),
      status: z.string(),
      patch: z.string().optional(),
    }),
  );

  return fileSchema.parse(await response.json());
}

export async function createJobFromPullRequestEvent(event: PullRequestEvent) {
  const changedFiles = await fetchPullRequestFiles(event);

  return createManualReviewJob({
    repo: {
      owner: event.repository.owner.login,
      name: event.repository.name,
      cloneUrl: event.repository.clone_url,
      defaultBranch: event.repository.default_branch,
    },
    pr: {
      number: event.pull_request.number,
      title: event.pull_request.title,
      body: event.pull_request.body ?? "",
      url: event.pull_request.html_url,
      headRef: event.pull_request.head.ref,
      baseRef: event.pull_request.base.ref,
      headSha: event.pull_request.head.sha,
    },
    changedFiles,
    runtime: {},
  });
}

export function hasPotentialVisualChanges(filenames: string[]) {
  return filenames.some((filename) =>
    [
      "app/",
      "pages/",
      "components/",
      "src/app/",
      "src/components/",
      "styles/",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".tsx",
      ".jsx",
    ].some((needle) => filename.includes(needle)),
  );
}
