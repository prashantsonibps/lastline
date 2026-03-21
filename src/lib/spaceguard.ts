import type { ChangedFile, PullRequestRef, RepoRef, ReviewRuntimeConfig } from "@/lib/types";

export function buildSpaceGuardManualRunInput() {
  return {
    repo: {
      owner: "prashantsonibps",
      name: "SpaceGuard",
      cloneUrl: "https://github.com/prashantsonibps/SpaceGuard.git",
    } satisfies RepoRef,
    pr: {
      number: 9999,
      title: "Manual SpaceGuard frontend review",
      body: "Smoke-test the current frontend as a live end-to-end validation run.",
      url: "https://github.com/prashantsonibps/SpaceGuard/pull/9999",
      headRef: "main",
      baseRef: "main",
      headSha: "manual-spaceguard-run",
    } satisfies PullRequestRef,
    changedFiles: [
      {
        filename: "frontend/src/app/page.tsx",
        status: "modified",
        patch: "Manual smoke target for globe landing validation",
      },
      {
        filename: "frontend/src/app/prediction/page.tsx",
        status: "modified",
        patch: "Manual smoke target for prediction markets validation",
      },
      {
        filename: "frontend/src/app/portfolio/page.tsx",
        status: "modified",
        patch: "Manual smoke target for portfolio validation",
      },
    ] satisfies ChangedFile[],
    runtime: {
      appDirectory: "frontend",
      reviewBaseUrl: "https://spaceguard-a0dbc.web.app",
      skipInstall: true,
      skipAppStart: true,
      env: {
        NEXT_PUBLIC_API_URL: "https://spaceguard-api-1040980823268.us-central1.run.app",
      },
      startTimeoutMs: 180000,
    } satisfies ReviewRuntimeConfig,
  };
}
