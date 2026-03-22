# Lastline

Lastline turns pull requests into review-ready evidence.

Instead of asking stakeholders to pull code, run branches, or interpret diffs, Lastline generates a guided QA walkthrough of the actual product experience, packages it into a single review artifact, and routes that artifact into the team communication loop where feedback already happens.

For engineering teams, that means faster feedback with less back-and-forth.

For non-technical reviewers, it means they can evaluate a change by watching what changed, leaving timestamped comments in plain language, and seeing those comments turn into structured follow-up work.

## Why it matters

Most teams have a gap between code review and product review.

Engineers can inspect a diff, but founders, designers, operators, and QA partners often care about something else:

- What changed in the experience?
- Does the interface feel correct?
- Did the workflow regress?
- Is the copy, state, or visual polish right?

That gap slows shipping because the people with the strongest product instincts are often the least likely to pull a branch and test it locally.

Lastline closes that gap by converting implementation changes into an observable walkthrough:

- it listens for PR activity
- it generates a focused QA plan from the actual implementation changes
- it runs those checks against the app
- it produces a stitched review video
- it delivers that artifact into Slack
- it turns timestamped human feedback into structured issues

The result is a review system that is legible to both engineers and non-engineers.

## What Lastline does

- Accepts GitHub pull request events
- Creates a review job with PR metadata, changed files, and runtime instructions
- Generates a structured QA plan using Gemini
- Runs browser-based validation against the target app
- Produces per-task artifacts and a stitched review video
- Stores durable review artifacts in Vercel Blob
- Exposes a stable `video_ready` handoff contract for the feedback layer
- Accepts timestamped findings and turns them into issue-ready records

## Who it helps

- Product managers who want to review real behavior without setting up a branch
- Founders who want confidence before merging user-facing changes
- Designers who need to inspect polish, layout, and visual regressions
- QA partners who want structured walkthroughs instead of vague “please test this” requests
- Engineering teams that want fewer fragmented review loops across PRs, chat, and issue trackers

## Workflow

```text
                    +-----------------------+
                    |    GitHub Pull Request|
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    |  Lastline Orchestrator|
                    |  - PR intake          |
                    |  - job creation       |
                    |  - QA plan generation |
                    +-----------+-----------+
                                |
                                v
             +---------------------------------------------+
             | Browser Review Runtime                      |
             | - open the target app                       |
             | - execute structured QA tasks               |
             | - capture review artifacts                  |
             | - compose a stitched walkthrough            |
             +--------------------+------------------------+
                                  |
                                  v
                    +-------------------------------+
                    | Durable Artifact Storage      |
                    | Vercel Blob                   |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Slack Review Delivery         |
                    | - send walkthrough            |
                    | - collect timestamped notes   |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Structured Follow-up          |
                    | - findings                    |
                    | - screenshots                 |
                    | - GitHub issues               |
                    +-------------------------------+
```

## System view

```text
GitHub
  -> /api/github/pr-webhook
  -> review job created
  -> planning
  -> testing
  -> video_ready
  -> awaiting_feedback
  -> creating_issues
  -> done

Slack
  -> receives the walkthrough
  -> reviewer replies with timestamps and notes
  -> Lastline structures the feedback
  -> issues are created with context and artifacts
```

## Why this is effective for non-technical reviewers

Lastline removes the tooling barrier.

A reviewer does not need to:

- clone a repository
- install dependencies
- switch branches
- run a dev server
- understand a Git diff

They only need to:

- watch the walkthrough
- spot something unexpected
- respond with a timestamp and a note

That is a dramatically lower-friction review surface, which means better participation from the people who usually catch product issues late.

## Current architecture

- Next.js control surface on Vercel
- GitHub webhook intake
- Gemini-driven QA plan generation
- Playwright-based browser automation
- FFmpeg-based composition and extraction
- Vercel Blob for durable artifacts
- chat-layer handoff for delivery and feedback

The control plane is designed to keep the review lifecycle explicit and inspectable:

- `queued`
- `planning`
- `testing`
- `video_ready`
- `awaiting_feedback`
- `creating_issues`
- `done`
- `failed`

## Running the system

1. Install dependencies

```bash
npm install
```

2. Copy the environment template and fill in the required values

```bash
cp .env.example .env.local
```

3. Start the control app

```bash
npm run dev
```

4. Trigger a review run

```bash
curl -X POST http://localhost:3000/api/reviews/run \
  -H "Content-Type: application/json" \
  --data @examples/spaceguard-manual-run.json
```

5. Inspect the resulting job

```bash
curl http://localhost:3000/api/reviews/<job-id>
```

6. Inspect the distilled handoff payload

```bash
curl http://localhost:3000/api/reviews/<job-id>/handoff
```

## Core endpoints

- `POST /api/github/pr-webhook`
- `POST /api/reviews/run`
- `POST /api/reviews/run/spaceguard`
- `GET /api/reviews/:jobId`
- `GET /api/reviews/:jobId/handoff`
- `POST /api/reviews/:jobId/feedback`
- `POST /api/reviews/:jobId/feedback/start`
- `POST /api/reviews/:jobId/artifacts/screenshot`

## Notes for deployment

- Vercel hosts the orchestration layer
- Vercel Blob stores durable review artifacts
- the review lifecycle is persisted as durable job state
- the feedback layer can consume a `video_ready` handoff without needing to understand the machine-side execution details

## Reference material

- [docs/integration-contract.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/integration-contract.md)
- [docs/person2-integration.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/docs/person2-integration.md)
