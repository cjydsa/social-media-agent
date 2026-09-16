# Frontend Track Rules

Read the root `AGENTS.md`, PRD, architecture, and contracts first.

## DOCS-FIRST DEVELOPMENT GATE

Before any change under this directory, first update the task Change Log and `docs/pr-review/domains/frontend.md`. The Frontend cannot invent a field, DTO, permission, or endpoint; request a coordinated Backend/Contracts docs change before implementation. Report `DOCS GATE: PASS` before code and stop if the UI design reveals an interface gap.

## May change

- `apps/pr-review-console/**`
- Frontend/browser tests owned by this app
- Frontend design documentation

## Must not change

- Algorithm or Backend implementation
- Frozen API fields without an approved cross-track contract change
- Existing Agent Inbox or generate-post flow

Use React + TypeScript + Vite when implementation begins. Access data only through the typed Backend API client. Never call an LLM, embed provider keys, infer allowed actions, recompute risk, or hard-code evaluation results. Render server-provided evidence and permissions, handle null/unknown values, require reasons for actions, and submit `expectedVersion`.
