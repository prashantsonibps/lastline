## Title

Capture one or more findings through a guided Telegram flow

## Type

AFK

## Blocked by

- `01-feedback-run-contract.md`
- `02-review-delivery.md`

## User stories covered

- User story 5
- User story 6
- User story 7
- User story 8
- User story 9
- User story 10
- User story 12
- User story 22
- User story 34

## What to build

Implement the guided reporting loop in Telegram so a reviewer can add one or more findings without using custom syntax. The flow should ask for a timestamp first, then ask for the issue description, then save a draft finding against the run.

This slice should include:

- reply handling tied to a known run and conversation state
- step-by-step prompting for timestamp then description
- draft finding persistence on the run
- confirmation after each saved finding
- a way to add another finding or move to issue creation
- guardrails that block issue creation when no findings exist

## Acceptance criteria

- [ ] A reviewer can submit a finding through a two-step guided flow without manual formatting rules.
- [ ] Multiple findings can be captured in the same session and persisted on the run.
- [ ] The system prevents empty issue-creation attempts when no findings are present.
- [ ] Missing or malformed timestamp input is rejected with a clear recovery prompt.
- [ ] Tests verify conversation progression, draft finding persistence, and zero-finding safeguards.

## Why this is a tracer bullet

This slice delivers the core human-in-the-loop value: the user can watch a video and turn observations into structured findings inside Telegram.
