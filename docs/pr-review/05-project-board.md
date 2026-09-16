# Project Board

> 共享任务状态源。领取任务时由 READY 移至 IN PROGRESS，并注明 owner/date；完成验收后依次进入 REVIEW、DONE。代码已写不等于 DONE。所有任务先遵循 `07-vibe-coding-workflow.md`。

## Required sequence

```text
DOCS-GATE-001
  -> DATA-001
  -> ALG-001 + TEST-001
  -> PRODUCT-001
  -> ALG-002 + ALG-003 + TEST-002
  -> SPRINT-004 Foundation: BE-001 + BE-002 + DATA-002 + TEST-004 Phase A
  -> ALG-004 RAG / LLM Reviewer
  -> Backend Orchestration MVP
  -> Frontend
  -> Evaluation
  -> Integration
```

## BACKLOG

- ALG-005 — OCR/VLM 视觉审核
- TEST-003 — Backend/API/Frontend E2E
- TEST-005 — 非功能与安全验证
- INT-002 — Docker、Demo 数据与一键启动
- INT-003 — Release readiness 与兼容验收
- WB-001 — WorkBuddy Skill / CLI Adapter（仅复用 headless ReviewEngine；package schema 待独立确认）

## READY

- 暂无

## IN PROGRESS

- 暂无

## BLOCKED

- 暂无

## REVIEW

- 暂无

## DONE

- M0-DOCS — Repository understanding、PRD、架构、合同、开发计划与 Project Board（Phase 0）
- INFRA-001 — Centralized Configuration & Secret Management
- INFRA-002 — DeepSeek & Qwen Provider Support
- DOCS-GATE-001 — Docs-first Governance（completed: 2026-08-18）
- DATA-001 — Social Data Interface / Contract / Fixture Design（completed: 2026-08-18；docs-only）
- ALG-001 — 冻结领域 Schema 与 ReviewEngine port（completed: 2026-08-31）
- TEST-001 — Contract 与 schema 测试基线（completed: 2026-08-31）
- PRODUCT-001 — 五维多智能体产品核心重对齐（completed: 2026-08-31）
- ALG-002 — Deterministic Multi-Agent LangGraph MVP（completed: 2026-08-31）
- ALG-003 — 五维评分、Decision Judge 与 Policy Guard（completed: 2026-08-31）
- TEST-002 — 五维 Multi-Agent Graph / Policy / Regression Suite（completed: 2026-08-31）
- BE-001 — API DTO、错误模型与路由骨架（completed: 2026-09-01）
- BE-002 — Repository 与 Case/Version/Audit 生命周期（completed: 2026-09-01）
- DATA-002 — Social Context MVP（completed: 2026-09-01；local_fixture / authorized_export only）
- TEST-004 — Public Content Review Benchmark v1 Phase A（completed: 2026-09-01）
- ALG-004 — Brand RAG 与结构化 LLM Reviewers Enablement（completed: 2026-09-01；未执行真实 API smoke）
- SPRINT-004 — Business Foundation & Real AI Enablement（completed: 2026-09-01）
- SPRINT-005 — Full-Stack Console（completed: 2026-09-16；MVP 切片交付：BE-003 orchestration、BE-004 dev-header Auth、BE-005 MockPublisher、FE-001..004 控制台、INT-001 composition root；durable checkpoint/resume、生产 OIDC、真实 publisher、浏览器 E2E 与 Docker 仍属 BACKLOG）

## Acceptance evidence

- DOCS-GATE-001：12 个 focused Jest cases、direct TypeScript typecheck、Prettier 和真实 working-tree docs check 通过；最终 `git diff --check` 见交付记录。
- DATA-001：PRD/Architecture/Contracts/Domain/Plan/Board reconciliation 完成；未实现真实 Adapter/爬虫。
- ALG-001：strict Zod public contracts、ReviewEngine/SocialContextProvider ports、UTF-16 validator 完成；无 graph/reviewer/Adapter/API。
- TEST-001：6 个 focused suites / 58 tests；全部源 PR Review regression 8 suites / 87 tests；typecheck/Prettier/docs checks/diff check 通过。
- PRODUCT-001：PRD v1.1、五维业务风险、Visual evidence layer、WorkBuddy headless adapter boundary 完成；`yarn pr-review:docs:check --task PRODUCT-001` 通过。
- ALG-002：LangGraph + MemorySaver、Planner、五个 deterministic Specialists、Critic、Judge、Revision、interrupt/resume/revision loop 完成；focused algorithm tests 5 suites / 37 tests 通过。
- ALG-003：五维评分、可配置 MVP 权重、FinalReviewDecision、Policy Guard hard gates 完成；hard blocker / missing evidence / conflict / failure 均 fail closed。
- TEST-002：source PR Review regression 13 suites / 134 tests 通过；typecheck、Prettier、四个 docs checks、`git diff --check` 见交付记录。
- BE-001：9 个 API route DTO/skeleton、strict validation、typed error envelope、pagination、content-type/request size validation 完成；focused BE tests 2 suites / 11 tests 通过。
- BE-002：Repository ports、InMemory adapter、immutable ContentVersion、append-only ReviewAction、optimistic locking、EvidenceSnapshot、revision transaction 完成。
- DATA-002：五个平台 synthetic fixture、LocalFixture/AuthorizedExport adapter、normalization、dedupe、SocialContextBuilder/Provider 完成；真实平台 API/crawler 调用为 0。
- TEST-004：Benchmark v1 Phase A 完成，81 synthetic cases（72 dev / 9 test），metrics 与 `pr-review:eval:validate` 通过。
- ALG-004：本地版本化 Knowledge Base、BM25 + simple vector + RRF、KnowledgeRetriever、Role Model Policy、LLM structured agent wrappers、prompt versioning、headless `reviewContent(...)` facade 完成；真实 DeepSeek/Qwen API 调用为 0。
- SPRINT-004：BE-001、BE-002、DATA-002、TEST-004 Phase A 与 ALG-004 全部完成；Prettier、TypeScript、focused tests、全部 PR Review tests、docs checks、eval validate 与 `git diff --check` 见交付记录。
- SPRINT-005：focused backend tests 4 suites / 25 tests、全部 PR Review tests（源 .ts）25 suites / 192 tests、根 tsc --noEmit、console tsc+vite build、PR Review 范围 Prettier、自动 docs gate（`--task SPRINT-005`）全部通过；curl E2E 冒烟覆盖 seed/越权/审批链/自我终审/排期幂等/409/422/400/401/415/上传/SPA 托管；真实 LLM/社媒/发布调用为 0。详见 `change-log/SPRINT-005.md` Validation Evidence。
