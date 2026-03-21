# Hackathon Implementation Plan

## Person 1

- Own GitHub PR intake, review-job orchestration, sandbox execution, QA-plan generation, Playwright recording, and video composition.
- Keep the contract to Person 2 simple: one `video_ready` run should produce repository identity, PR metadata, ordered task summaries, a stitched video artifact reference, and useful logs.
- Treat Vercel as the control plane and sandbox launcher, not the browser runtime itself. The control app should trigger isolated review jobs that can clone repos, install deps, boot apps, and run Playwright.

## Person 2

- Own Telegram delivery and the human feedback loop.
- Use Chat SDK for the review inbox and conversation state.
- Required flow:
  1. Receive completed review artifact metadata from Person 1.
  2. Send the stitched review video to Telegram.
  3. Accept natural-language timestamp feedback from the user.
  4. Parse feedback into structured issue candidates.
  5. Request screenshots for referenced timestamps from the video-processing layer.
  6. Create GitHub issues with the user text, screenshot, and full video link.

## Shared Interfaces

- `POST /api/github/pr-webhook`
  Creates the review job from a PR event.
- `POST /api/reviews/run`
  Manual or internal trigger for review runs.
- `GET /api/reviews/:jobId`
  Returns status, logs, tasks, and artifact paths for downstream consumers.

## Shared Run Lifecycle

- Target statuses:
  - `queued`
  - `planning`
  - `testing`
  - `video_ready`
  - `awaiting_feedback`
  - `creating_issues`
  - `done`
  - `failed`
- The current codebase still uses a coarser MVP status model, so the next implementation step is to migrate review jobs toward the richer lifecycle above.
- The full contract and reconciliation notes live in [docs/integration-contract.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/integration-contract.md).

## Vercel Deployment Notes

- Deploy this Next.js app on Vercel as the orchestration surface.
- Mirror these env vars in Vercel project settings and in GitHub Actions secrets/variables:
  - `GEMINI_API_KEY`
  - `GEMINI_QA_MODEL`
  - `GITHUB_TOKEN`
  - `GITHUB_WEBHOOK_SECRET`
  - `REVIEW_APP_BASE_URL`
  - `FFMPEG_PATH`
- For local development, use `.env.local`.
- For CI or GitHub Actions, use repository secrets for sensitive values and repository variables for non-sensitive defaults like model name.

## Near-Term Build Order

- Prove one full manual run against `SpaceGuard`.
- Add a stable `video_ready` artifact handoff shape for Person 2.
- Replace local file-backed job execution with the Vercel-friendly execution path you choose for the hackathon demo.
- Add screenshot extraction from video timestamps.
- Add issue creation and Telegram delivery.
