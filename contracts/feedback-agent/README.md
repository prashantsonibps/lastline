# Feedback-Agent Issues

This folder contains only the implementation slices for Person 2's work:

- agent logic after `video_ready`
- QA task formatting for human review
- Telegram delivery and reply handling
- timestamp parsing
- screenshot extraction from the stitched video
- GitHub issue creation
- final UX flow and polish

These slices are derived from [sparsh_prd.md](/Users/sparshpaliwal/Desktop/hackathons/vercelGoogle/lastline/sparsh_prd.md) and are intentionally written as thin vertical slices.

## Order

1. `01-feedback-run-contract.md`
2. `02-review-delivery.md`
3. `03-guided-finding-capture.md`
4. `04-timestamp-and-screenshot-pipeline.md`
5. `05-issue-drafting-and-github-creation.md`
6. `06-demo-polish-and-happy-path.md`

## Notes

- `AFK` slices can be implemented without additional user decisions.
- `HITL` slices need manual UX review or demo acceptance.
- The machine-side pipeline is intentionally out of scope except where a contract is required.
