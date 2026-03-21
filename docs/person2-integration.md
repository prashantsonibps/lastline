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
- Feedback mutations:
  - `POST /api/reviews/:jobId/feedback`
- Screenshot extraction:
  - `POST /api/reviews/:jobId/artifacts/screenshot`

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
4. Call `POST /api/reviews/:jobId/feedback` with `action: "start_feedback"` when the video is delivered.
5. Send the stitched video to Telegram.
6. Collect timestamped findings.
7. Save each finding through `POST /api/reviews/:jobId/feedback` with `action: "save_finding"`.
8. Extract screenshots from the stitched video through `POST /api/reviews/:jobId/artifacts/screenshot`.
9. Create GitHub issues in the same repo as the PR.
10. Call `POST /api/reviews/:jobId/feedback` with `action: "mark_issue_created"` per finding.
11. Move status through `creating_issues` and `done` with `action: "set_status"`.

## Feedback Mutation Payloads

### Start feedback

```json
{
  "action": "start_feedback",
  "telegramChatId": "123456",
  "telegramMessageId": "789"
}
```

### Save finding

```json
{
  "action": "save_finding",
  "timestampText": "1:13",
  "note": "In light mode the headings should be black, not white."
}
```

### Mark issue created

```json
{
  "action": "mark_issue_created",
  "findingId": "finding-id",
  "issueUrl": "https://github.com/prashantsonibps/SpaceGuard/issues/123"
}
```

### Update run status

```json
{
  "action": "set_status",
  "status": "creating_issues"
}
```

### Extract screenshot

```json
{
  "timestampText": "1:13",
  "findingId": "finding-id"
}
```

Response:

```json
{
  "timestampSeconds": 73,
  "screenshot": {
    "kind": "remote_url",
    "location": "https://...",
    "isDurable": true
  }
}
```

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
