## Title

Normalize timestamps and extract screenshots from the stitched video

## Type

AFK

## Blocked by

- `01-feedback-run-contract.md`
- `03-guided-finding-capture.md`

## User stories covered

- User story 11
- User story 12
- User story 17
- User story 18
- User story 20
- User story 21
- User story 30

## What to build

Implement the media side of the feedback-agent so persisted findings with user-entered timestamps can be normalized into integer seconds and converted into screenshot artifacts taken from the stitched final video.

This slice should include:

- timestamp parsing and normalization
- validation rules for accepted timestamp formats
- screenshot extraction orchestration using the stitched video as the source of truth
- reuse of the same screenshot when multiple findings share the same timestamp
- graceful handling when extraction fails

## Acceptance criteria

- [ ] User-entered timestamps are normalized into canonical integer seconds.
- [ ] Invalid timestamps are rejected cleanly before screenshot work is attempted.
- [ ] The system can request or generate a screenshot for a finding against the stitched video artifact.
- [ ] Findings that share a timestamp reuse the same screenshot artifact when appropriate.
- [ ] Screenshot extraction failure does not discard the finding and is represented in downstream issue inputs.
- [ ] Tests verify timestamp normalization, shared-timestamp reuse, and extraction-failure behavior.

## Why this is a tracer bullet

This slice turns a raw user note into anchored visual evidence, which is the bridge between chat interaction and actionable engineering output.
