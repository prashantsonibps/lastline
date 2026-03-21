# Person 2 Integration Brief

This is the shortest path for the Telegram and issue-creation track.

## What Exists Today

- Person 1 can produce a completed machine-side run that reaches `video_ready`.
- The run now contains a `handoff` block with:
  - repo owner and name
  - PR number, title, and URL
  - commit SHA
  - ordered QA task summaries
  - stitched video artifact
- If `BLOB_READ_WRITE_TOKEN` is configured, the stitched video is uploaded to Vercel Blob and exposed as a durable public URL.

## API To Consume

- Full run:
  - `GET /api/reviews/:jobId`
- Person-2-friendly handoff:
  - `GET /api/reviews/:jobId/handoff`

## Handoff Response Shape

```json
{
  "id": "job-id",
  "status": "video_ready",
  "repo": {
    "owner": "prashantsonibps",
    "name": "SpaceGuard"
  },
  "pr": {
    "number": 9999,
    "title": "Manual SpaceGuard frontend review",
    "url": "https://github.com/prashantsonibps/SpaceGuard/pull/9999"
  },
  "commitSha": "manual-spaceguard-run",
  "qaTaskSummaries": [
    {
      "id": "spaceguard-globe-smoke",
      "title": "Globe Landing Smoke Test",
      "goal": "Verify the live landing experience renders the top navigation and live telemetry banner correctly.",
      "steps": ["..."],
      "expected": ["..."]
    }
  ],
  "stitchedVideo": {
    "kind": "remote_url",
    "location": "https://...",
    "isDurable": true
  },
  "feedback": {
    "findings": []
  },
  "error": null,
  "updatedAt": "2026-03-21T16:51:19.592Z"
}
```

## What Person 2 Should Assume

- Start from `video_ready`.
- If `stitchedVideo.kind === "remote_url"`, send that URL or upload that video into Telegram.
- If it is still `local_path`, the run is usable only for local development and should not be treated as durable.
- Store Telegram and feedback state back onto the same run object instead of creating a separate state system.

## Recommended Person 2 Flow

1. Poll `GET /api/reviews/:jobId/handoff`.
2. Wait for `status === "video_ready"`.
3. Read `qaTaskSummaries` to build the Telegram summary.
4. Send the stitched video to Telegram.
5. Collect timestamped findings.
6. Normalize timestamps to integer seconds.
7. Extract screenshots from the stitched video.
8. Create GitHub issues in the same repo as the PR.

## Notes For Person 2 Codex

- The run lifecycle target is:
  - `queued`
  - `planning`
  - `testing`
  - `video_ready`
  - `awaiting_feedback`
  - `creating_issues`
  - `done`
  - `failed`
- The machine-side implementation already produces:
  - final stitched video
  - ordered QA task summaries
  - the `video_ready` handoff payload
- The next expected writes from Person 2 are:
  - update `feedback.findings`
  - store Telegram delivery metadata
  - move status through `awaiting_feedback`, `creating_issues`, and `done`

