## Problem Statement

Developers are increasingly using long-running coding agents that open pull requests with substantial UI and UX changes. Those PRs often need fast human review, but the current workflow is fragmented: someone must understand what changed, run the app, manually test likely affected flows, record evidence, share findings with stakeholders, and then translate stakeholder feedback into actionable GitHub issues.

For this hackathon, the product already has a machine-side implementation direction that can pull a PR, generate a QA plan, run Playwright, and produce a stitched review video. The remaining problem is the human-interaction loop after the video is ready. The system needs a reliable, polished way to deliver the review video to a human in Telegram, collect timestamped bug reports, attach screenshots from the referenced video moments, and create clear GitHub issues without losing the original intent of the user’s feedback.

The user needs this part of the system to be isolated, testable, and robust enough that it can be demonstrated confidently even if the rest of the pipeline is evolving in parallel.

## Solution

Build a dedicated feedback-agent module for the human-facing half of the workflow. This module begins when a completed PR review run reaches a `video_ready` state and exposes a guided Telegram experience using Chat SDK components that are actually supported on Telegram.

The module sends a review summary and stitched video to the user, then guides them through a structured conversation for reporting bugs one at a time. Each finding is stored as structured draft state against the same run. When the user chooses to create issues, the module normalizes timestamps, extracts screenshots from the stitched video, uses Gemini to polish each finding into a clean but faithful GitHub issue draft, and creates one issue per finding in the same repository as the PR.

The implementation should live as an isolated deep module with a stable interface, clear phase transitions, and strong behavior-focused tests. It should integrate with the existing review job state rather than introducing a second parallel state system.

## User Stories

1. As a developer reviewing an AI-generated PR, I want the review video delivered to me in Telegram, so that I can inspect changes without opening the repo locally.
2. As a developer reviewing an AI-generated PR, I want to see which PR the video came from, so that I can quickly associate the review session with the correct code change.
3. As a developer reviewing an AI-generated PR, I want to see a short summary of what was tested, so that I know what the video is intended to cover.
4. As a developer reviewing an AI-generated PR, I want to see the QA task titles included in the run, so that I can map sections of the video to expected flows.
5. As a developer reviewing an AI-generated PR, I want to report bugs from Telegram without learning a custom syntax, so that the workflow feels effortless.
6. As a developer reviewing an AI-generated PR, I want the bot to guide me step-by-step when I report a bug, so that I do not need to remember formatting rules.
7. As a developer reviewing an AI-generated PR, I want to enter a timestamp and then describe the issue, so that the system can anchor my feedback to the video.
8. As a developer reviewing an AI-generated PR, I want to add multiple findings in one review session, so that I can report everything I notice before creating issues.
9. As a developer reviewing an AI-generated PR, I want the bot to confirm that my finding was saved, so that I trust nothing was lost.
10. As a developer reviewing an AI-generated PR, I want to be prevented from creating issues before adding any findings, so that I do not accidentally submit an empty review.
11. As a developer reviewing an AI-generated PR, I want timestamps normalized consistently, so that minor formatting mistakes do not break the flow.
12. As a developer reviewing an AI-generated PR, I want the system to reject missing timestamps clearly, so that every issue has usable evidence.
13. As a developer reviewing an AI-generated PR, I want one GitHub issue per finding, so that the output is precise and easy to track.
14. As a developer reviewing an AI-generated PR, I want the GitHub issue to include my original wording, so that my intent is preserved.
15. As a developer reviewing an AI-generated PR, I want the GitHub issue to also be polished for readability, so that teammates can act on it quickly.
16. As a developer reviewing an AI-generated PR, I want the issue to include the PR link, so that engineers can trace the bug back to the source change.
17. As a developer reviewing an AI-generated PR, I want the issue to include the referenced timestamp, so that engineers can jump to the right moment in the video.
18. As a developer reviewing an AI-generated PR, I want the issue to include a screenshot from the relevant video moment, so that the visual problem is easy to understand.
19. As a developer reviewing an AI-generated PR, I want the issue to include access to the full review video, so that the team can replay the entire context.
20. As a developer reviewing an AI-generated PR, I want the system to continue creating issues even if screenshot extraction fails, so that my report is never dropped.
21. As a developer reviewing an AI-generated PR, I want the system to reuse the same screenshot when two findings share a timestamp, so that duplicate work is avoided.
22. As a developer reviewing an AI-generated PR, I want the feedback flow to survive server restarts or webhook retries, so that long-running review sessions remain reliable.
23. As a developer building the hackathon demo, I want the feedback-agent state to live in the same run record as the machine-side state, so that debugging is straightforward.
24. As a developer building the hackathon demo, I want the feedback-agent to begin only after a clear `video_ready` handoff, so that phase ownership is unambiguous.
25. As a developer building the hackathon demo, I want the human-facing logic isolated from the machine-facing logic, so that my implementation can be tested independently.
26. As a developer building the hackathon demo, I want a minimal but polished Telegram card experience that uses supported Chat SDK primitives, so that the demo feels intentional without relying on unsupported UI.
27. As a developer building the hackathon demo, I want to use Gemini to convert raw user notes into structured issue drafts, so that issue quality is high while meaning stays intact.
28. As a developer building the hackathon demo, I want issue creation to target the same repository as the PR by default, so that there is no unnecessary configuration during the demo.
29. As a developer building the hackathon demo, I want the manual PR run path to remain usable, so that the team can retry the same showcase PR until the demo is perfect.
30. As a developer building the hackathon demo, I want the feedback-agent to be developed with TDD around stable interfaces, so that the core logic is trustworthy even under time pressure.
31. As a teammate integrating the machine-side pipeline, I want a clear contract for what data must exist before feedback begins, so that our work can evolve without confusion.
32. As a teammate integrating the machine-side pipeline, I want to know exactly which state fields the feedback-agent expects to read and update, so that we do not step on each other’s work.
33. As a stakeholder watching the demo, I want the experience to feel like a single agent loop from PR to issues, so that the product vision is obvious.
34. As a stakeholder watching the demo, I want the Telegram interaction to feel smooth and guided, so that the human-in-the-loop aspect feels magical rather than manual.
35. As an engineer triaging the created issues later, I want the issue body to separate observed behavior, expected behavior, and original note, so that the bug report is immediately actionable.

## Implementation Decisions

- The PRD covers only the feedback-agent side of the product, not the machine-side PR checkout, sandbox execution, Playwright recording, or Blob upload implementation.
- The feedback-agent will be implemented as an isolated module with its own internal submodules for state, Telegram interaction, feedback collection, issue drafting, media handling, prompts, and tests.
- The overall product is treated as one agent from the demo perspective, but internally the flow is split into distinct phases. The feedback-agent owns the phases after the machine side has finished producing a stitched review video.
- The canonical run status model for the combined workflow is: `queued`, `planning`, `testing`, `video_ready`, `awaiting_feedback`, `creating_issues`, `done`, and `failed`.
- The machine-side integration handoff is a run entering `video_ready` with the required metadata already present. The feedback-agent should not guess readiness from partial data.
- The feedback-agent will reuse the existing review job state as the source of truth rather than introducing a second persistence system.
- Telegram metadata will live on the same run object as the rest of the review state for MVP simplicity and debuggability.
- The machine-side implementation is responsible for durable Blob upload of the stitched video. The feedback-agent consumes a Blob URL or equivalent durable artifact reference rather than local file paths.
- The minimal required handoff data from the machine side includes repository identity, PR number, PR URL, commit SHA, ordered QA task summaries, stitched video artifact reference, and a status indicating the video is ready for human review.
- The feedback-agent will extend the shared run state with structured feedback fields, including draft findings, normalized timestamps, screenshot artifact references, Telegram session metadata, and GitHub issue creation results.
- The Telegram UX will use supported Chat SDK primitives for Telegram: summary content, video delivery, and button-based progression. The system will not rely on inline editable form rows or unsupported rich-input widgets.
- The Telegram reporting flow will be sequential and guided:
- The user receives a review summary and video.
- The user chooses to report a bug.
- The bot asks for a timestamp.
- The bot asks for a bug description.
- The system stores a draft finding.
- The user can add another finding or create issues.
- The feedback-agent stores timestamps internally as integer seconds. User-entered timestamps may be accepted loosely, but they will be normalized before persistence.
- A finding without a timestamp is invalid in MVP and should be rejected with a clear prompt to provide one.
- The system will allow multiple findings to share the same timestamp.
- The system will not implement general-purpose editing of draft findings in MVP. At most, a minimal “clear last finding” escape hatch may be added later if necessary.
- The system will not perform fuzzy deduplication in MVP. One finding becomes one issue unless there is an exact duplicate submission that can be trivially ignored.
- Gemini is responsible for polishing raw user findings into structured issue drafts, but it must preserve the user’s meaning. The created issue should include both a polished interpretation and the original user note.
- Gemini output should be constrained into structured fields rather than free-form full issue text generation. The final issue body will be rendered through a fixed template for consistency.
- The issue template should include: report origin, timestamp, PR link, observed behavior, expected behavior, original user note, screenshot reference, and full review video link.
- The feedback-agent will create issues in the same repository as the source PR by default.
- Screenshot extraction will use `ffmpeg` against the stitched final video rather than trying to reuse Playwright session internals. This keeps the feedback-agent aligned with what the human reviewer actually saw.
- If screenshot extraction fails, the system should still create the GitHub issue and explicitly note that screenshot generation failed.
- The feedback-agent should support a local or fake `video_ready` run as the first development slice so the chat and issue flows can be built before the full pipeline is complete.
- The first stable integration slice is: given a completed run and one user-reported bug, save the finding, normalize the timestamp, extract the screenshot, build the issue payload, and create or simulate issue creation.
- The feedback-agent should expose a deep, stable interface centered around run-level operations such as “start feedback for run,” “save finding,” and “create issues for run,” instead of leaking transport-specific or prompt-specific details across the codebase.
- The PRD should be committed into the repository so another agent or teammate can read it and implement against the same assumptions.

## Testing Decisions

- Good tests should validate externally observable behavior and stable contracts rather than internal implementation details. Tests should assert what the module does for a given run state and user input, not how many helper functions it calls.
- The highest-priority tests should focus on the deep module boundaries:
- timestamp normalization and validation
- finding persistence behavior
- state transitions across feedback phases
- screenshot extraction orchestration
- issue draft generation from raw user input
- GitHub issue payload construction
- Telegram conversation-state progression
- The first red-green test slice should start from a fake `video_ready` run and one Telegram-style bug report, then verify that a draft finding is saved, timestamp seconds are normalized, a screenshot request is issued, and an issue draft is produced.
- Media tests should verify that timestamp-to-screenshot extraction is invoked correctly and that failure is handled gracefully without blocking issue creation.
- Prompt-related tests should not snapshot raw model prose. Instead, tests should verify that prompt consumers produce stable structured outputs or graceful fallbacks when model results are incomplete.
- Integration tests should verify the full happy path from `video_ready` to `done` using mocked Telegram, mocked Gemini, mocked GitHub issue creation, and a local video fixture.
- Since the current codebase is still early-stage, there is limited direct prior art for the feedback-agent. The module should therefore establish its own testing conventions around run-state fixtures and transport adapters.
- The implementation should prefer testable pure functions for parsing, normalization, issue templating, and state transition decisions, with thin adapters around Telegram, GitHub, and media execution.

## Out of Scope

- Implementing the machine-side PR webhook intake, repository checkout, dependency installation, app startup, Playwright execution, or stitched video generation.
- Implementing Blob upload for the stitched video.
- Building a fully generic multi-platform messaging workflow beyond Telegram.
- Supporting rich Telegram inline form inputs that are not actually available through the supported adapter capabilities.
- Full authentication and authorization systems beyond minimal demo-safe protection.
- Advanced finding editing, reordering, merging, or deduplication UX.
- Automatically understanding the entire application codebase for issue creation after the video is ready.
- Creating aggregate issues, project board updates, or cross-repo issue routing.
- Replacing the manual-run demo path as the primary development loop for the hackathon.

## Further Notes

- The product pitch can still present the experience as one end-to-end autonomous loop from PR to issues, but the implementation should remain explicit about phase boundaries for reliability.
- The isolated feedback-agent module exists to let one developer move quickly and confidently without being blocked by the machine-side pipeline’s internal changes.
- The shared state contract between teammates is the most important integration surface. If there is ambiguity between statuses, artifact references, or required fields, the contract should be clarified before additional implementation is layered on top.
- The most important UX constraint discovered during planning is that Telegram should be treated as a guided conversation with buttons, not as a rich inline form surface.
- The most important technical constraint discovered during planning is that the final stitched video, not intermediate Playwright artifacts, is the source of truth for user-referenced screenshots.
