# Test Track Rules

Read the root `AGENTS.md`, PRD, architecture, contracts, and task acceptance criteria first.

## DOCS-FIRST DEVELOPMENT GATE

Before changing tests or evals, first write the task's Test plan in its Change Log and update `docs/pr-review/domains/test-and-evaluation.md`. Contract expectation changes require `docs/pr-review/03-contracts.md` first. Report `DOCS GATE: PASS` before test code. Expected behavior comes from approved docs, never retrospectively from the current implementation.

## May change

- `tests/pr-review/**`
- Test-only fixtures and test configuration when scoped and compatible
- Production code only when the assigned task explicitly includes a fix; do not weaken tests to accept a defect

## Must not change

- Model benchmark labels/results in `evals/pr-review/**` without Evaluation ownership
- Existing tests merely to hide generate-post regressions
- Frozen contracts without the change process

Use deterministic mocks for model/network/social services. Clearly label synthetic fixtures and never claim they are human annotations. Cover fail-closed behavior, roles, versions, idempotency, interrupt/resume, and MockPublisher guards. Software correctness tests are not model-quality evaluation.

Future platform Adapter contract tests must use fixtures/mocks and cover required fields, timestamp normalization, malformed/duplicate data, missing engagement, rate limits, provider unavailable, invalid responses, and empty queries. Unit tests must not call real social platform APIs.
