## Title

Draft polished issues and create one GitHub issue per finding

## Type

AFK

## Blocked by

- `01-feedback-run-contract.md`
- `03-guided-finding-capture.md`
- `04-timestamp-and-screenshot-pipeline.md`

## User stories covered

- User story 13
- User story 14
- User story 15
- User story 16
- User story 17
- User story 18
- User story 19
- User story 20
- User story 27
- User story 28
- User story 35

## What to build

Implement the issue-creation path so the system can take persisted findings, optional screenshot artifacts, and review-run metadata, then use Gemini to produce structured drafts and create one GitHub issue per finding in the source repository.

This slice should include:

- structured issue draft generation from raw user notes
- a fixed issue template that preserves both polished content and the original user wording
- GitHub issue payload construction
- creation of one issue per finding in the same repository as the PR
- persistence of created issue references back onto the run
- transition from `creating_issues` to `done`

## Acceptance criteria

- [ ] The system can turn a saved finding into structured issue fields without changing the user’s meaning.
- [ ] Each created issue includes timestamp, PR reference, original user note, and full review video reference.
- [ ] Screenshot artifacts are included when available, and issue creation still succeeds when screenshots are unavailable.
- [ ] One GitHub issue is created for each finding and linked back to the run state.
- [ ] Tests verify issue draft generation, payload construction, and one-finding-to-one-issue behavior.

## Why this is a tracer bullet

This slice completes the business loop from human feedback to engineering artifact and is independently demoable with mocked upstream inputs.
