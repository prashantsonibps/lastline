## Title

Feedback run contract and local fixtures

## Type

AFK

## Blocked by

None - can start immediately

## User stories covered

- User story 22
- User story 23
- User story 24
- User story 25
- User story 29
- User story 30
- User story 31
- User story 32

## What to build

Define the feedback-agent's stable contract around a run that has reached `video_ready`, along with the additional state the feedback-agent owns after handoff. This slice should make it possible to develop the rest of the module against fake completed runs without waiting on the machine-side pipeline.

This slice should establish:

- the shared run fields the feedback-agent expects to read
- the feedback-specific fields the feedback-agent expects to write
- the allowed state transitions after `video_ready`
- fixture builders or sample run records that let later slices develop and test locally
- a clear separation between machine-owned and feedback-owned fields

## Acceptance criteria

- [ ] There is a documented and implemented run-level contract for entering the feedback-agent at `video_ready`.
- [ ] The contract includes ordered QA task summaries, durable video reference, repo and PR metadata, and feedback-owned state fields.
- [ ] The feedback-agent can be bootstrapped from a fake completed run without invoking the machine-side pipeline.
- [ ] State transitions for `video_ready`, `awaiting_feedback`, `creating_issues`, `done`, and `failed` are defined and testable.
- [ ] Tests verify contract validation and post-handoff state transitions using local fixtures.

## Why this is a tracer bullet

This slice cuts through schema, state management, and test setup in a minimal but complete way. Once done, every later slice can build against the same stable run contract.
