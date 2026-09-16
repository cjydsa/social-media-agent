# Configuration and Secret Rules

Read the root `AGENTS.md` and PR Review architecture/config documentation first.

## DOCS-FIRST DEVELOPMENT GATE

Before any change under this directory, first update the task Change Log, `docs/pr-review/06-environment-and-api-config.md`, and `docs/pr-review/domains/algorithm.md`; update Contracts/Architecture first when a shared interface changes. Report `DOCS GATE: PASS` before code and stop if implementation needs a design change.

## May change

- `src/pr-review/config/**`
- `.env.pr-review.example`, config doctor, and config-focused tests
- Config-related documentation through the normal contract review process

## Must not change

- Existing legacy client environment access as part of an infrastructure-only task
- Frontend code to consume this server-only module
- Real publisher or provider integrations without a separately authorized task

Only `env.ts` may read `process.env` in the PR Review subsystem. Never log, serialize, trace, or return raw `SecretValue` contents. New variables need Zod validation, a documented lifecycle/requirement classification, a safe default where appropriate, doctor output, and tests. Missing optional integrations must not block mock/local startup. Production safety checks may tighten but never weaken development publishing protection.

Provider credentials are conditional: require only the key selected by `LLM_PROVIDER`. Qwen additionally requires an explicit region/workspace `QWEN_BASE_URL`; do not hard-code a regional endpoint. Model identifiers remain in `LLM_MODEL`, not adapters or reviewers.
