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

Create `.env.local` with:

```bash
OPENAI_API_KEY=
OPENAI_QA_MODEL=gpt-4.1
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=
APP_BASE_URL=http://127.0.0.1:3000
APP_PORT=3000
REVIEW_APP_BASE_URL=http://127.0.0.1:3100
FFMPEG_PATH=ffmpeg
```

## Next steps

- Install dependencies
- Install Playwright browsers
- Add Telegram delivery and issue creation on the other track
- Tighten repo checkout for forked PRs and private repos
