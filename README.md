# Lastline

PR review video agent scaffold for the hackathon MVP.

## What is implemented

- GitHub PR webhook intake at `/api/github/pr-webhook`
- Manual run endpoint at `/api/reviews/run`
- File-backed review job store under `.review-jobs/`
- PR workspace preparation with clone, checkout, and dependency install
- QA plan generation via AI SDK with a deterministic JSON schema
- Playwright task runner with per-task video recording
- FFmpeg intro-card generation and final video stitching
- `video_ready` handoff payload for the feedback agent
- Minimal dashboard at `/`

## Environment

`.env.local` is already scaffolded for you. Fill it in locally, and mirror the same keys in Vercel project env vars and GitHub Actions secrets.

The checked-in template lives at [.env.example](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/.env.example).

Current env shape:

```bash
GEMINI_API_KEY=
GEMINI_QA_MODEL=gemini-2.5-pro
GEMINI_FEEDBACK_MODEL=gemini-2.5-pro
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=
BLOB_READ_WRITE_TOKEN=
JOBS_ROOT_DIR=
APP_PORT=3000
REVIEW_APP_BASE_URL=http://127.0.0.1:3100
FFMPEG_PATH=ffmpeg
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
TICTACTOE_MODEL=
```

On Vercel, runtime job files should live in `/tmp`. The app now defaults to `/tmp/lastline-review-jobs` automatically when deployed. `JOBS_ROOT_DIR` is optional and mainly useful if you want to override that path locally.

## Vercel Blob

1. In Vercel, create or connect a Blob store to this project.
2. Add `BLOB_READ_WRITE_TOKEN` to the project env vars.
3. Add the same token to local `.env.local` for local uploads.
4. When configured, the stitched final review video uploads automatically and `handoff.stitchedVideo` becomes a durable public URL.

## Deployment

- Vercel should host this Next.js control app.
- GitHub webhook should point to `/api/github/pr-webhook` on the deployed app.
- Use the same env names locally, in Vercel, and in GitHub Actions to avoid config drift.
- Person 2’s planning notes and the shared implementation split are in [docs/hackathon-plan.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/hackathon-plan.md).
- The machine-side and feedback-side reconciliation contract is in [docs/integration-contract.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/integration-contract.md).
- Person 2’s API contract and handoff brief are in [docs/person2-integration.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/person2-integration.md).

## Manual run

1. Start this control app:

```bash
npm install
npm run dev
```

2. Post the sample payload:

```bash
curl -X POST http://localhost:3000/api/reviews/run \
  -H "Content-Type: application/json" \
  --data @examples/spaceguard-manual-run.json
```

3. Poll the job:

```bash
curl http://localhost:3000/api/reviews/<job-id>
```

4. Fetch the distilled `video_ready` handoff payload directly:

```bash
curl http://localhost:3000/api/reviews/<job-id>/handoff
```

5. Start feedback delivery for a `video_ready` job:

```bash
curl -X POST http://localhost:3000/api/reviews/<job-id>/feedback/start \
  -H "Content-Type: application/json" \
  --data '{"chatId":"<telegram-chat-id>"}'
```

When the machine-side flow succeeds, the run will move into `video_ready` and expose a `handoff` block containing PR metadata, ordered QA task summaries, and the stitched video artifact reference for Person 2’s feedback agent.

6. Person 2 can write feedback state back onto the same run through:

```bash
curl -X POST http://localhost:3000/api/reviews/<job-id>/feedback \
  -H "Content-Type: application/json" \
  -d '{"action":"save_finding","timestampText":"1:13","note":"Heading color is wrong in light mode."}'
```
## Next steps

- Install dependencies
- Install Playwright browsers
- Add Telegram delivery and issue creation on the other track
- Tighten repo checkout for forked PRs and private repos
