# Algorithm Domain

## 1. 边界

Algorithm 负责审核决策：LangGraph 流程、规则、Reviewer、证据归一化、confidence、风险聚合、路由、revision 和结构化输出。它不负责 HTTP、数据库实现、身份认证、UI、Publisher 或平台数据采集。

Backend 只能通过冻结的 `ReviewEngine` port 调用 Algorithm。Reviewer 只能通过统一 provider factory 获取模型，不能读取 Secret 或直接构造 provider SDK client。

## 2. 当前行为

截至 DATA-001，`src/pr-review/algorithm/` 只有 Phase 0 skeleton 与 INFRA-001/002 的 Provider 基础设施；ReviewEngine、审核 graph、rules 和 reviewers 尚未实现。

配置/Provider 现状是在实现后由 DOCS-GATE-001 回溯确认：Mock、DeepSeek、Qwen 通过统一 factory；OpenAI/Anthropic 是配置枚举但没有 PR Review adapter。详细事实以 `06-environment-and-api-config.md` 和历史 Change Log 为准。

## 2.1 SPRINT-005 对 Algorithm 的影响

SPRINT-005（Full-Stack Console）**不改变任何 Algorithm 业务行为**：graph、五维 reviewer、RAG、Policy Guard、schema 全部冻结不变。本轮仅在 `src/pr-review/config/` additive 新增 server/upload/auth/seed 配置读取（见 `06-environment-and-api-config.md` 5.2），供 composition root（`src/pr-review/server/`）注入；Algorithm 代码不读取这些变量。Backend/Server 仍只能通过 `ReviewEngine` port 与 `reviewContent(...)` facade 调用 Algorithm。

## 3. Docs-first Gate

修改 `src/pr-review/algorithm/**` 之前必须先：

1. 创建/更新任务 Change Log 的 Pre-Implementation Design；
2. 修改本文相应章节；
3. 若改变 Schema、ReviewEngine 或跨域 port，先修改 `03-contracts.md`；
4. 输出 `DOCS GATE: PASS` 后才修改代码。

Provider/config 变化还要先更新 `06-environment-and-api-config.md`。实现中设计变化必须停止代码并回到文档步骤。

## 4. 稳定依赖方向

```text
Backend -> ReviewEngine -> Algorithm graph/reviewers
                              |
                              +-> Provider Factory -> ChatModel
                              +-> SocialContextProvider -> SocialContextSnapshot
```

Algorithm 不得导入 Backend、Frontend 或任何 Weibo/Xiaohongshu/Douyin/Bilibili/Coolapk SDK/Adapter。Social context 是可选证据输入；Provider 不可用不得默认为 approve。

## 5. DATA-001 对 Algorithm 的预先约束

- Reputation Reviewer 只依赖 `SocialContextProvider`，不消费原始平台响应或主动调用平台 API。
- 社媒讨论是 reputation risk/evidence mismatch/insufficient support 的证据，不是事实真假的唯一裁决依据。
- Snapshot 缺失、过期、低覆盖或来源不可用必须显式降低 confidence 或进入人工审核，不能转成 LOW 自动通过。
- Social Schema/port 的 TypeScript 实现不属于 DATA-001；实施前须更新本文与 Contracts。

## 6. ALG-001 详细设计

### 6.1 Public schema 与单一事实源

ALG-001 在 `schemas/` 实现 Contracts 冻结的 `ContentType`、`ReviewDecision`、`RiskLevel`、`IssueCategory`、`Severity`、`ReviewerType`、`ReviewActionType`、`ReviewStage`、`ReviewCase`、`ReviewResult`、`ReviewIssue`、`EvidenceItem` 和 `ReviewAction`。Zod runtime schema 是唯一事实源，TypeScript domain type 只通过 `z.infer` 导出；禁止同名手写 interface 与 schema 双轨维护。

所有固定 public object 和 fixed nested object 使用适配当前 Zod v4 的 strict object。未知字段 validation fail，不静默 strip。共用 primitives 统一提供：trim 后非空 ID、显式时区 ISO timestamp、正整数 version、非负整数 count/token、`[0,1]` score/confidence 和 JSON-safe details。

ReviewStage 采用完整冻结列表：

```text
REQUESTER_SELF_CHECK
OPERATOR_REVIEW
VISUAL_REVIEW
COMPLIANCE_REVIEW
RISK_ROUTING
MEDIA_MANAGER_APPROVAL
SCHEDULING
COMPLETED
REJECTED
ESCALATED
REVIEW_REQUIRED
```

### 6.2 ReviewResult 与 contextual validation

`ReviewIssueSchema` 只验证 `textSpan` 为整数 UTF-16 code-unit `[start,end)`、`start >= 0`、`end > start`；它无法知道当前正文，因此不得声称验证 quote 或上界。

`validation/review-result.ts` 提供 `validateReviewResultAgainstContent(result, currentContent)`：先运行 strict `ReviewResultSchema`，再对每个 non-null span 校验 `end <= currentContent.length` 及 `quote === currentContent.slice(start,end)`。ASCII、中文 BMP 字符和 emoji surrogate pair 均遵循 JavaScript slice 的 UTF-16 offset；失败以包含 issue path 的 Zod validation error 报告。

数值边界：confidence `[0,1]`；evidence score 为 null 或 `[0,1]`；latency 非负；token 为非负整数；estimated cost 为 null 或非负。ReviewAction 的 REVISE 还执行相邻 version invariant。

### 6.3 ReviewEngine public port

`ReviewEngineInput` 只携带 Algorithm 当前 snapshot：caseId、version、contentType、targetPlatform、currentContent、imageUrls、currentStage、policyVersion。ALG-001 不需要 originalContent，因为不实现 diff/revision algorithm；Algorithm 不自行访问业务数据库。

`ReviewContext` 是 runtime capability context，不是 HTTP context：包含 requestId、nullable deadline、脱敏 scalar trace metadata、nullable cancellation capability，以及 strict dependencies 中 nullable `SocialContextProvider`。禁止 Express Request/Response、database client、Frontend state、Secret、完整正文 trace metadata 或 provider SDK client。模型构造仍只能走 `createReviewModel(config.llm)`。

`ReviewEngineOutput` 冻结 results、nullable aggregateResult、nextStage、requiresHuman、nullable interrupt、execution 和 failures。nullable aggregate 表达聚合前失败；本轮不实现 ALG-003 aggregate。`ResumeReviewInput` 是 action discriminated union，`REVISE` 才允许且要求 revisedContent。Interrupt 只冻结 `HUMAN_REVIEW` 描述符，Backend 未来仍负责权限收窄。ExecutionReference 只做 execution/thread/run correlation，不创建 checkpoint。

`ports/review-engine.ts` 只声明 `review` / `resume` 方法；没有 `ReviewEngineImpl`、LangGraph、rule、reviewer 或 router。public barrel 不导出任何未来 internals。

### 6.4 Typed failure 与 fail-closed boundary

Public failure code 冻结为 `INVALID_INPUT`、`SCHEMA_VALIDATION_FAILED`、`DEPENDENCY_UNAVAILABLE`、`TIMEOUT`、`CANCELLED`、`REVIEWER_FAILED`、`INTERNAL_ERROR`，并携带 message、retryable、typed source 和 nullable JSON-safe details。Architecture 的 model/retrieval/visual/schema 具体原因映射到 code + source/details；failure 不会被转换为 APPROVE/LOW。本轮只实现 schema，不实现 exception mapping、retry 或 routing。

### 6.5 Social runtime contract 范围

ALG-001 实现 DATA-001 枚举与纯数据 Zod schemas：`SocialPlatform`、`SocialAccessMode`、`FixtureProvenance`、`SocialMediaType`、`SocialProviderStatus`、SocialPost、SocialComment、SocialSearchInput/Result、SocialContextQuery/Snapshot，并实现 Algorithm-facing `SocialContextProvider` port。固定 nested objects strict，timestamp/ID/count/nullability 服从 Contracts；SocialSearchInput query trim 后非空，limit 为正整数，空 query 在调用任何 provider 前 validation fail。

本轮明确不实现 `SocialDataAdapter` runtime port、Normalization、Store、Retrieval 或任何 Weibo/Xiaohongshu/Douyin/Bilibili/Coolapk Adapter。Reputation Reviewer 仍不存在，也没有网络、账号、fixture ingestion 或平台调用。DATA-002 必须独立通过 Docs Gate 后才能实现这些行为。

### 6.6 Public file layout

```text
schemas/common.ts
schemas/review-case.ts
schemas/review-result.ts
schemas/review-action.ts
schemas/review-engine.ts
schemas/social.ts
ports/review-engine.ts
ports/social-context.ts
validation/review-result.ts
index.ts
```

该布局按职责拆分且不创建空目录。`index.ts` 是业务消费者的稳定入口；providers 保持现状且不因 ALG-001 被重构。

### 6.7 TEST-001 对应验收

TEST-001 的预先矩阵验证 enums、strict/nested strict、ReviewCase version/time、ReviewResult 数值与 UTF-16 contextual spans、ReviewAction invariant、ReviewEngine import/schema/failure、JSON round trip 和 Social schema/provider port。测试只消费 public barrel，不根据实现反向改变预期。

## 7. PRODUCT-001 / ALG-002 / ALG-003 五维详细设计

### 7.1 产品级维度

一级业务风险域固定为 `PUBLIC_RELATIONS`、`OPERATIONS`、`PRODUCT`、`CUSTOMER`、`COMPLIANCE_SAFETY`。`IssueCategory` 是二级 taxonomy；legacy FACT/BRAND/COMPLIANCE/REPUTATION 保留兼容，VISUAL 仅作历史值。Visual 能力统一迁移到 Multimodal Evidence Layer。

### 7.2 Graph 与 Agent 分工

执行顺序为 Input Validation → Content Understanding → Review Planner → Evidence Planning → 五个 Specialist 并行 → Evidence Critic → Decision Judge → deterministic Policy Guard → Revision/HITL/Final。Planner 五维至少 LIGHT；Specialist 独立输出 0–100 分；Critic 检查证据与冲突；Judge 提供 AI-style 综合建议；Guard 执行不可绕过 hard gate；Revision 只生成建议，不覆盖正文。

### 7.3 State 与 ports

Graph state 只保存 schema-valid snapshot、plan、evidence、结果、失败、revisionCount、execution 与 interrupt。所有 provider 通过 `ReviewContext.dependencies` 的 Algorithm-facing ports 注入，provider client/Secret/HTTP/DB 不进入 state。Social Context 只为 PUBLIC_RELATIONS/CUSTOMER 提供风险证据，不作事实唯一依据。真实 OCR/VLM、RAG、LLM 与 Social Adapter 均不在本轮。

### 7.4 Policy 与 fail closed

默认权重 0.25/0.15/0.20/0.20/0.20 和阈值 25/40/49/0.75 均为可注入 MVP defaults。CRITICAL、HIGH compliance、HIGH unsupported product claim、privacy/confidential leakage、reviewer failure 永不 PASS；缺证据、低 confidence 或冲突进入 HUMAN_REVIEW。Judge 不得绕过 Guard。

### 7.5 Deterministic mock 范围

ALG-002 使用 LangGraph `MemorySaver` 和 fixture-driven deterministic agents，覆盖 normal、五个单维风险、multi-risk、missing-evidence、reviewer-conflict、reviewer-failure。相同业务输入和 fixture 必须得到相同业务结果；execution correlation IDs 不参与语义等价比较。

### 7.6 Public 边界

Backend 继续只依赖 ALG-001 `ReviewEngine`。v1.1 schema 与 engine factory 由 public barrel 导出，graph nodes、fixture resolver 与内部 state 不作为 Backend 稳定接口。未来 `reviewContent` facade、CLI 与 WorkBuddy 只做 Adapter，不复制审核逻辑。

## 8. SPRINT-004 / ALG-004 设计草案

### 8.1 当前依赖状态

ALG-004 不是 SPRINT-004 的第一步。它必须等待：

- ALG-003 已 DONE。
- BE-002 repository/evidence snapshot port 已 DONE。
- TEST-004 Public Content Review Benchmark v1 Phase A 已 DONE。

在 BE-002 与 TEST-004 Phase A 未验收前，Project Board 中 ALG-004 必须保持 BLOCKED。不得通过直接修改 Algorithm 源码绕过依赖。

DATA-002 不是所有 ALG-004 case 的硬依赖；但当 PUBLIC_RELATIONS 或 CUSTOMER review plan 要求 Social Context 时，Algorithm 必须支持 provider unavailable、partial coverage 与 missing evidence 的 graceful fail-closed 语义。

### 8.2 Versioned Evidence RAG

ALG-004 的本地知识库目录：

```text
knowledge/pr/
knowledge/brand/
knowledge/product/
knowledge/customer/
knowledge/compliance/
knowledge/platform/
```

每份知识文档必须包含：

- `documentId`
- `sourceType`
- `version`
- `effectiveAt`
- `title`
- `content`
- `tags`

第一版检索实现：

- BM25 lexical retrieval。
- simple local vector retrieval。
- Reciprocal Rank Fusion（RRF）。
- topK、去重、evidence score。
- 映射为 `EvidenceItem` 并保留 `knowledgeVersion`。

不得为了技术名词引入不必要的外部向量数据库。本地索引可满足 MVP。

### 8.3 Agent Tool Boundary

Specialist 不直接读取 repository implementation，也不直接访问平台 API。工具只返回 typed evidence 或 typed result。

PUBLIC_RELATIONS：

- `searchBrandKnowledge`
- `getSocialContext`
- `searchHistoricalPrCases`

OPERATIONS：

- `getPlatformPolicy`
- `getCampaignBrief`
- `getAccountProfile`

PRODUCT：

- `searchProductKnowledge`
- `searchApprovedClaims`

CUSTOMER：

- `getSocialContext`
- `searchCustomerFaq`
- `searchServicePolicy`

COMPLIANCE_SAFETY：

- `searchComplianceKnowledge`
- `getPlatformPolicy`
- `getRuleEngineResult`

### 8.4 Role Model Policy 与执行模式

新增 role model policy：

- planner
- specialist
- critic
- judge
- revision

每个 role 独立配置 provider/model。默认开发建议：

- Planner：DeepSeek
- 5 Specialists：DeepSeek
- Evidence Critic：Qwen
- Decision Judge：Qwen
- Revision：DeepSeek

该策略必须可配置，不得在 Agent 内硬编码。执行模式：

- `mock`：继续使用 deterministic agents。
- `hybrid`：deterministic rules + real LLM reviewers/judge。
- `real`：Planner/Specialists/Critic/Judge/Revision 均使用真实 LLM agent。

Policy Guard 永远 deterministic。

### 8.5 真实 LLM Agent

ALG-004 实现：

- `LLMReviewPlanner`
- `LLMDimensionReviewer`
- `LLMEvidenceCritic`
- `LLMDecisionJudge`
- `LLMRevisionAgent`

所有输出都必须使用现有 Zod contracts structured parse。parse failure 允许有限重试，重试失败后进入 HUMAN_REVIEW / REVIEW_REQUIRED。不得默认 PASS。

Prompt 必须分文件并版本化：

```text
prompts/planner/
prompts/specialist/
prompts/critic/
prompts/judge/
prompts/revision/
```

Prompt 必须包含 promptVersion、role、input contract、output contract、evidence rules、forbidden behavior。Agent 不得编造 evidence；证据不足时输出 missingEvidence。

### 8.6 LangSmith 与隐私

真实 Agent 调用可被 LangSmith 追踪。trace metadata 只允许包含：

- `caseId`
- `version`
- `executionId`
- `agentRole`
- `dimension`
- `provider`
- `model`
- `promptVersion`
- `knowledgeVersion`
- `latency`
- token usage

禁止记录 API Key、PII、完整敏感正文、完整敏感 evidence。`TRACE_CONTENT_ENABLED=false` 必须继续生效。

### 8.7 Headless facade

新增最小稳定 facade：

```typescript
reviewContent(input, options): Promise<FinalReviewDecision>
```

Facade 调用同一个 `ReviewEngine`，不重新实现 Agent 或 graph。未来 CLI、Backend、WorkBuddy Adapter 都应依赖该入口或同一 ReviewEngine port，而不是导入 graph internals。
