# Algorithm Track Rules

Read the root `AGENTS.md`, PRD, architecture, and contracts first.

## DOCS-FIRST DEVELOPMENT GATE

Before any change under this directory, first update the task Change Log and `docs/pr-review/domains/algorithm.md`. If a Schema, ReviewEngine port, shared result, or SocialContext port changes, update `docs/pr-review/03-contracts.md` first too. Provider/config changes also require `06-environment-and-api-config.md`. Only after reporting `DOCS GATE: PASS` may code change; stop and return to docs if design shifts.

## May change

- `src/pr-review/algorithm/**`
- Algorithm-focused tests under `tests/pr-review/algorithm/**`
- Algorithm evaluation runners/config under `evals/pr-review/**` when coordinated with Test/Evaluation owners
- Contract docs only through the frozen-contract change process

## Must not change

- `src/pr-review/backend/**`, `apps/pr-review-console/**`, HTTP routes, database adapters, auth, UI, or publishers
- Existing `src/agents/generate-post/**` and `src/agents/upload-post/**` behavior

Expose behavior only through `ReviewEngine` and the frozen schemas. Keep prompts inside `prompts/`, provider calls behind reviewer/retrieval/visual ports, and graph state internal. Every structured model response must validate; any failure is typed and fail-closed. Do not store business records or call social platforms. Reputation Review may only consume normalized snapshots through `SocialContextProvider`; social evidence is not a sole factual verdict.

Reviewers must obtain chat models through `createReviewModel(config.llm)`. They must not import provider SDK constructors, read API keys, or add full review content/PII to custom LangSmith metadata when `TRACE_CONTENT_ENABLED=false`.
