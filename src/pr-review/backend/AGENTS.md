# Backend Track Rules

Read the root `AGENTS.md`, PRD, architecture, and contracts first.

## DOCS-FIRST DEVELOPMENT GATE

Before any change under this directory, first update the task Change Log and `docs/pr-review/domains/backend.md`. Any endpoint, DTO, error, pagination, auth, or concurrency contract change requires `docs/pr-review/03-contracts.md` first. Cross-Domain work requires every affected Domain doc. Report `DOCS GATE: PASS` before code and stop implementation if design changes.

## May change

- `src/pr-review/backend/**`
- Backend/API/integration tests under `tests/pr-review/**`
- API sections of `docs/pr-review/03-contracts.md` only through the contract change process

## Must not change

- `src/pr-review/algorithm/prompts/**`, reviewers, routing, or graph internals
- `apps/pr-review-console/**` unless a coordinated cross-track task says so
- Existing real publisher/client behavior

Call Algorithm only through `ReviewEngine`; never implement risk classification in services/controllers. Keep DTO validation separate from domain mapping. Revisions are immutable/transactional, actions append-only, mutations idempotent, and version conflicts explicit. Default to MockPublisher and do not accept client-supplied identity.
