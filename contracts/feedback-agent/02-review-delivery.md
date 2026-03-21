## Title

Deliver a review summary and video to Telegram

## Type

AFK

## Blocked by

- `01-feedback-run-contract.md`

## User stories covered

- User story 1
- User story 2
- User story 3
- User story 4
- User story 24
- User story 26
- User story 33
- User story 34

## What to build

Implement the first user-visible feedback-agent slice: given a `video_ready` run, format the QA tasks into a human-readable summary and deliver the stitched review video plus next-step actions through Telegram using supported Chat SDK primitives.

This slice should include:

- task formatting for human-readable review summaries
- Telegram delivery of PR context and video
- binding the outbound Telegram message/thread to the run
- a minimal action surface such as `Report bug` and `Create issues`
- transition from `video_ready` to `awaiting_feedback`

## Acceptance criteria

- [ ] Given a fake or real `video_ready` run, the system can produce a user-readable review summary from QA task data.
- [ ] The review summary and stitched video can be delivered through the Telegram adapter.
- [ ] Telegram metadata is persisted on the same run record so later replies can resolve back to the correct run.
- [ ] The run enters `awaiting_feedback` once delivery succeeds.
- [ ] Tests verify summary formatting, delivery orchestration, and run-to-Telegram binding behavior.

## Why this is a tracer bullet

This slice creates the first end-to-end human-visible behavior on your side: a completed review becomes a delivered Telegram experience.
