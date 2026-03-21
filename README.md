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
APP_PORT=3000
REVIEW_APP_BASE_URL=http://127.0.0.1:3100
FFMPEG_PATH=ffmpeg
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
```

## Deployment

- Vercel should host this Next.js control app.
- GitHub webhook should point to `/api/github/pr-webhook` on the deployed app.
- Use the same env names locally, in Vercel, and in GitHub Actions to avoid config drift.
- Person 2’s planning notes and the shared implementation split are in [docs/hackathon-plan.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/hackathon-plan.md).

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

4. Start feedback delivery for a `video_ready` job:

```bash
curl -X POST http://localhost:3000/api/reviews/<job-id>/feedback/start \
  -H "Content-Type: application/json" \
  --data '{"chatId":"<telegram-chat-id>"}'
```

## Next steps

- Install dependencies
- Install Playwright browsers
- Add Telegram delivery and issue creation on the other track
- Tighten repo checkout for forked PRs and private repos
