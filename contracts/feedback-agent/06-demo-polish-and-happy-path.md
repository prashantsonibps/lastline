## Title

Polish the end-to-end feedback demo path

## Type

HITL

## Blocked by

- `01-feedback-run-contract.md`
- `02-review-delivery.md`
- `03-guided-finding-capture.md`
- `04-timestamp-and-screenshot-pipeline.md`
- `05-issue-drafting-and-github-creation.md`

## User stories covered

- User story 26
- User story 29
- User story 33
- User story 34

## What to build

Harden and polish the complete feedback-agent demo loop so the team can repeatedly run the same showcase PR through delivery, finding capture, screenshot generation, and issue creation with a clean user experience.

This slice should include:

- manual-run-friendly happy-path validation
- copy and UX polish for summary and reply prompts
- handling of common demo-time recovery cases
- verification that the full flow works against a known sample run
- final acceptance pass on what the Telegram experience feels like

## Acceptance criteria

- [ ] The team can repeatedly start from a known completed run and drive the full person-2 flow without manual state surgery.
- [ ] Telegram prompts and confirmations are clear enough that a first-time reviewer can complete the flow without instruction.
- [ ] Common demo failures have graceful recovery paths or clear operator guidance.
- [ ] The complete feedback loop has a verified happy path from `video_ready` to created issues.
- [ ] Manual review confirms that the experience feels polished enough for the hackathon demo.

## Why this is a tracer bullet

This slice is the demo hardening pass. It does not add a new subsystem, but it makes the existing vertical slices feel like one coherent product.
