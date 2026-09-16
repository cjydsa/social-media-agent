# Enterprise PR Review Engineering Rules

These rules apply to the whole repository. More specific `AGENTS.md` files override only within their directory; they may tighten but not weaken these rules.

## DOCS-FIRST DEVELOPMENT GATE — highest priority

- Before modifying any source, test, script, runtime config, or public interface, first create/update `docs/pr-review/change-log/<TASK-ID>.md` with the complete Pre-Implementation Design required by `docs/pr-review/07-vibe-coding-workflow.md`.
- Before code in a Domain changes, modify every affected `docs/pr-review/domains/*.md`. Cross-Domain tasks require all affected Domain docs before any code file is touched.
- Schema, port, DTO, or API changes also require `docs/pr-review/03-contracts.md` to change first. Config/provider changes require `06-environment-and-api-config.md` first.
- After the Markdown changes and before code, explicitly report `DOCS GATE: PASS`, listing changed docs, reasons, planned code files, and matching sections. With no Markdown change, report `DOCS GATE: FAIL` and do not modify code.
- If implementation reveals a design change, stop code work, append (do not rewrite) the Change Log design-change record, update Domain/Contracts docs, and pass the Gate again.
- Tests must follow the pre-implementation Test plan; they must not reverse-engineer expected behavior from the implementation.
- Run `yarn pr-review:docs:check --task <TASK-ID>` as a second-line co-change check. It does not prove edit ordering and never replaces the manual Gate.
- PHASE-0/INFRA-001/INFRA-002 are the only historical backfills. New tasks must never backfill design documentation after implementation.

## Required context

- Before changing PR-review code, read `docs/pr-review/01-PRD.md`, `02-architecture.md`, `03-contracts.md`, `04-development-plan.md`, `05-project-board.md`, `07-vibe-coding-workflow.md`, the affected Domain docs, and applicable `AGENTS.md` completely.
- Before adding a provider, environment variable, feature flag, tracing field, or publisher setting, read `docs/pr-review/06-environment-and-api-config.md` and use `src/pr-review/config/`.
- Check `docs/pr-review/05-project-board.md`; move the task through the board and update its acceptance evidence.
- Preserve existing `generate_post`, Agent Inbox, scheduling, and `upload_post` behavior unless a task explicitly authorizes a compatibility change.

## Frozen contracts and truthful data

- Do not casually modify frozen schemas. Public interface changes require synchronized updates to contracts, schemas, API tests, consumers, migration notes, and the project board.
- Do not hard-code experiment metrics, expected resume metrics, or benchmark outcomes.
- Do not generate or claim fake human-labeled data. Synthetic data is allowed only when clearly labeled `synthetic` with provenance.
- Social fixtures must distinguish `synthetic`, `manually_curated`, and `authorized_export`; manually curated does not imply human-labeled ground truth.
- Do not submit API keys, access tokens, credentials, private content, or unredacted personal data.

## Safety and boundaries

- Only `src/pr-review/config/env.ts` may read `process.env` inside the PR Review subsystem. Backend/Algorithm business modules receive typed config; Frontend must never import the server config layer.
- Secrets must use the centralized redacted representation and must never enter logs, API responses, frontend bundles, or LangSmith trace metadata/content by default.
- PR Review model construction must go through `createReviewModel(config.llm)`. Reviewer modules may not instantiate OpenAI, Anthropic, DeepSeek, Qwen, or other provider SDK clients directly.
- Development and test environments must never publish to a real account by default. Use `MockPublisher`; a real publisher requires an explicit production gate and task authorization.
- Keep Algorithm and Backend layered. Backend must use the stable `ReviewEngine` interface and must not import prompts, reviewers, graph nodes, or implement risk decisions.
- Frontend must call Backend APIs only. It must not call models, import Algorithm code, or expose provider credentials.
- Validate every LLM structured output with the frozen schema. Parse, model, retrieval, visual, timeout, and validation failures must not default to approve.
- Never silently treat an unavailable reviewer or missing evidence as LOW confidence approval.
- Social platform access must use `official_api`, `authorized_export`, `local_fixture`, or `disabled`. Never bypass login, CAPTCHA, access controls, rate limits, or anti-scraping controls.
- Algorithm may consume social evidence only through `SocialContextProvider`; it must never call platform APIs or treat social discussion as the sole factual verdict.

## Quality

- New behavior requires proportionate tests. Software tests belong in `tests/pr-review/`; model-quality evaluation belongs in `evals/pr-review/`.
- Keep dependency direction acyclic: Frontend -> Backend -> Algorithm; Algorithm never depends on Backend/Frontend.
- Record prompt, rule, model, knowledge, dataset, and algorithm versions where relevant to replayability.
- If PRD and code conflict, report the conflict and obtain/record a decision; do not silently rewrite product requirements.
- Before completion, run the relevant build/lint/test commands and honestly record anything that could not run.

## Change scope

- Phase 0 skeleton files do not authorize business implementation.
- Avoid changes to `src/agents/generate-post/**`, `src/agents/upload-post/**`, social clients, and existing graph IDs. If unavoidable, add explicit regression coverage and call it out in review.
