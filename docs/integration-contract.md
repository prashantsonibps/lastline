# Integration Contract

This document aligns the current Person 1 implementation with the feedback-agent PRD in [sparsh_prd.md](/Users/prashantsoni/Desktop/Vercel*Deepmind_hackathon/sparsh_prd.md).

## Current State

The repo already supports the machine-side MVP:

- GitHub PR intake
- manual review-job runs
- repo checkout and app startup
- Gemini QA-plan generation
- Playwright recording
- intro-card creation
- final stitched review video generation

The repo does **not** yet implement the durable handoff contract that Person 2’s Telegram and issue-creation flow expects.

## Required Shared Run Phases

Person 2’s PRD is correct to treat the workflow as one run with distinct phases. The target run-status model should be:

- `queued`
- `planning`
- `testing`
- `video_ready`
- `awaiting_feedback`
- `creating_issues`
- `done`
- `failed`

## Mapping From Today’s MVP

Current MVP statuses:

- `queued`
- `running`
- `completed`
- `failed`
- `ignored`

Recommended migration:

- `queued` stays `queued`
- `running` should split into `planning` and `testing`
- `completed` should split into `video_ready`, `awaiting_feedback`, `creating_issues`, and `done`
- `ignored` can remain as a machine-side convenience state if needed for non-visual PRs

## Minimum Handoff From Person 1 To Person 2

Before feedback begins, the run should contain:

- repository owner and name
- PR number
- PR URL
- PR title
- commit SHA
- ordered QA task summaries
- final stitched video artifact reference
- machine-side logs or artifact metadata helpful for debugging
- run status set to `video_ready`

For hackathon MVP, the stitched video artifact can start as a local or temporary URL during development, but the Vercel-facing architecture should assume a durable uploaded artifact.

## Person 1 Responsibilities

- Produce the stitched review video and ordered QA task summaries.
- Promote the run into `video_ready` only when the final artifact reference is actually usable.
- Avoid coupling Telegram or GitHub issue logic into the machine-side runner.
- Treat Vercel as the orchestration surface, not the place where long-running browser execution must permanently live.

## Person 2 Responsibilities

- Begin only from `video_ready`.
- Store feedback state on the same run object rather than in a parallel store.
- Move the run through `awaiting_feedback`, `creating_issues`, and `done`.
- Use the stitched video as the source of truth for screenshot extraction.

## Immediate Build Plan

1. Person 1 should update the run model to support the richer phase states and artifact handoff fields.
2. Person 1 should add a stable artifact payload shape on the review job API.
3. Person 2 should build against a fake or manually seeded `video_ready` run first.
4. After the contract is stable, Person 1 can replace local execution assumptions with the Vercel-friendly runner strategy.

## Vercel Guidance

For the hackathon demo, Vercel should host the orchestration app and public APIs. The heavy execution path should be treated as an isolated review-run environment triggered by the control app. This preserves the product story while avoiding tight coupling between serverless request handling and long-running repo execution.

