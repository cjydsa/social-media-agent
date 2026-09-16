# SPRINT-004 — Business Foundation & Real AI Enablement

Documentation status: pre-implementation

## Task ID

SPRINT-004

## 背景

当前 PR Review 子系统已经完成五维多智能体审核的 Mock MVP：包含 LangGraph、多 Agent 编排、Planner、五个 Specialist、Evidence Critic、Decision Judge、Policy Guard、Revision Agent、interrupt/resume、revision loop 与 fail-closed 合同。

但是系统仍缺少业务级 MVP 所需的后端 API、Case/Version/Evidence/Audit 持久化边界、可运行 Social Context、Benchmark Dataset、版本化 RAG、真实 LLM Agent 启用能力与基础评测工具。

## 当前行为

- Algorithm 层已经有可运行 Mock Multi-Agent Graph。
- ReviewEngine public port 已冻结。
- Social Context 仅有合同与 Algorithm-facing port，尚无运行时 Adapter。
- Backend 仅有目录与边界文档，尚无 API DTO、Repository port 或 InMemory Adapter。
- Evaluation 仅有占位 README，尚无 Benchmark v1、manifest、loader 或 metrics。
- `04-development-plan.md` 中 ALG-004 依赖 BE-002 与 TEST-004 Dataset Manifest，但 `05-project-board.md` 曾将 ALG-004 标记为 READY，存在依赖状态不一致。

## 期望行为

本 Sprint 按依赖顺序推进：

1. 先修正 ALG-004 依赖状态：BE-002 与 TEST-004 Phase A 未完成前，ALG-004 必须保持 BLOCKED。
2. 完成 BE-001 Backend API Foundation。
3. 完成 BE-002 Repository / Version / Audit Foundation。
4. 完成 DATA-002 Social Context MVP。
5. 完成 TEST-004 Public Content Review Benchmark v1 Phase A。
6. 在上述依赖验收通过后，才允许 ALG-004 进入 READY 并实现 Evidence RAG 与真实 LLM Agent 启用能力。

## 预计修改文件

### 文档

- `docs/pr-review/change-log/SPRINT-004.md`
- `docs/pr-review/change-log/BE-001.md`
- `docs/pr-review/change-log/BE-002.md`
- `docs/pr-review/change-log/DATA-002.md`
- `docs/pr-review/change-log/TEST-004.md`
- `docs/pr-review/change-log/ALG-004.md`
- `docs/pr-review/02-architecture.md`
- `docs/pr-review/03-contracts.md`
- `docs/pr-review/04-development-plan.md`
- `docs/pr-review/05-project-board.md`
- `docs/pr-review/06-environment-and-api-config.md`
- `docs/pr-review/domains/backend.md`
- `docs/pr-review/domains/social-data.md`
- `docs/pr-review/domains/test-and-evaluation.md`
- `docs/pr-review/domains/algorithm.md`
- `evals/pr-review/README.md`

### 代码与测试

Docs Gate 通过后，预计修改：

- `src/pr-review/backend/**`
- `src/pr-review/social-data/**`
- `src/pr-review/algorithm/retrieval/**`
- `src/pr-review/algorithm/llm/**`
- `src/pr-review/algorithm/prompts/**`
- `src/pr-review/algorithm/engine/**`
- `src/pr-review/config/**`
- `evals/pr-review/**`
- `scripts/pr-review-eval-validate.ts`
- `tests/pr-review/backend/**`
- `tests/pr-review/social-data/**`
- `tests/pr-review/evaluation/**`
- `tests/pr-review/algorithm/**`

## 接口变化

- 新增 Backend API DTO 与 error envelope。
- 新增 Repository ports 与 InMemory adapter 合同。
- 新增 EvidenceSnapshot 合同。
- 新增 SocialDataAdapter runtime port、LocalFixtureSocialAdapter、AuthorizedExportSocialAdapter 与 SocialContextProvider MVP 合同。
- 新增 Benchmark Dataset、manifest、loader、metrics 与 validation command 合同。
- 新增 KnowledgeDocument、KnowledgeRetriever、RoleModelPolicy、ExecutionMode、真实 LLM Agent 合同。
- 新增 headless facade：`reviewContent(...)`。

## 状态 / Schema 变化

- ContentVersion 必须 immutable。
- ReviewAction 必须 append-only。
- ReviewResult 与 EvidenceSnapshot 必须绑定 `caseId + version + executionId`。
- EvidenceSnapshot 记录审核时使用的 `knowledgeVersion` 与 `socialContextVersion`。
- SocialContextSnapshot 扩展为可运行聚合结果，包含 `platformCoverage`、`topTopics`、`emergingRisks`、`negativeSignals` 与 `providerStatus`。
- Benchmark Case 必须记录 provenance，不允许将 synthetic 冒充真实数据。
- ALG-004 的 RAG 知识文档必须版本化。

## 校验规则

- 所有 DTO、repository record、social fixture、dataset case、metrics input/output 与 LLM structured output 均由 Zod schema 校验。
- Backend DTO unknown fields 必须失败。
- Repository mutation 必须通过 optimistic locking 的 `expectedVersion`。
- Social fixture 必须带 provenance。
- Dataset 必须校验重复 ID、split leakage、label completeness 与 provenance。
- RAG evidence 必须带 knowledge version。
- LLM structured output parse failure 必须 fail closed。

## 错误处理

- Backend 返回 typed error envelope，不泄露内部异常或 secret。
- Repository version conflict 返回明确冲突错误。
- Social provider unavailable 不得表示为空成功；必须在 `providerStatus` 或 typed failure 中体现。
- Dataset validate 失败必须非零退出。
- LLM parse failure、timeout、tool unavailable、missing evidence 不得默认 PASS。

## 测试计划

- BE-001 focused API contract tests。
- BE-002 repository contract tests。
- DATA-002 social adapter/provider tests。
- TEST-004 dataset/metrics/validate tests。
- ALG-004 RAG、LLM structured agent、execution mode、facade tests。
- 所有 PR Review regression tests。
- TypeScript typecheck、Prettier、docs checks、`git diff --check`。

## 验收标准

- Foundation Docs Gate：BE-001、BE-002、DATA-002、TEST-004 全部 PASS。
- Foundation 实现与测试通过后，BE-001、BE-002、DATA-002、TEST-004 Phase A 标记 DONE。
- 依赖满足后 ALG-004 才能从 BLOCKED 移到 READY。
- ALG-004 Docs Gate PASS 后才允许实现 RAG / Real AI Enablement。
- 最终不调用真实社媒 API、不调用 Publisher、不修改 `.env`、不打印 secret。

## 非目标

- 不实现 Frontend。
- 不实现 OCR/VLM。
- 不实现真实 Publisher。
- 不实现未经授权的真实社媒 Connector。
- 不绕过登录、验证码、反爬或平台访问限制。
- 不实现最终 WorkBuddy package。
- 不硬编码评测结果。

## Implementation Result

2026-09-01 已完成 SPRINT-004 范围内的 Foundation 与 ALG-004 enablement。

- BE-001：完成 Backend API DTO、typed error envelope、pagination contract、request content-type/size validation 与 route/controller skeleton。
- BE-002：完成 Repository ports、InMemory adapter、immutable ContentVersion、append-only ReviewAction、optimistic locking、EvidenceSnapshot 与 revision transaction。
- DATA-002：完成 SocialDataAdapter runtime port、LocalFixtureSocialAdapter、AuthorizedExportSocialAdapter、normalization、dedupe、SocialContextBuilder 与 SocialContextProvider MVP。
- TEST-004 Phase A：完成 Public Content Review Benchmark v1 dataset schema、manifest、loader、metrics 与 `pr-review:eval:validate`。
- ALG-004：完成本地版本化 RAG、Role Model Policy、LLM structured agent wrappers、prompt versioning 与 headless `reviewContent(...)` facade。
- DeepSeek calls = 0；Qwen calls = 0；Social API calls = 0；Publisher calls = 0。

## Validation Evidence

- Foundation Docs Gate：BE-001、BE-002、DATA-002、TEST-004 均 PASS。
- ALG-004 Docs Gate：PASS。
- Prettier check：PASS。
- TypeScript direct check：PASS。
- Focused tests：6 suites / 27 tests PASS。
- All PR Review tests：21 suites / 167 tests PASS。
- Evaluation dataset validation：81 synthetic cases，72 dev / 9 test，PASS。
