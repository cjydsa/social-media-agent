# 技术架构设计

## 1. 架构原则

采用模块化单体起步，按 Algorithm、Backend、Frontend、Test & Evaluation 四条开发线隔离，并以 Social Data 作为 Algorithm 的受控证据供应域；未来可在接口不变时拆服务。依赖方向固定为：

```text
Frontend -> Backend API -> Backend Services -> Algorithm ReviewEngine
                                  |                    |
                          Repository/Publisher     LangGraph/Reviewers
                                  |
                         Audit + business database

tests 可依赖公共接口；evals 通过 ReviewEngine/evaluation runner 调用，不反向被生产代码依赖。
```

禁止 `algorithm -> backend`、`backend -> algorithm/prompts/*`、`frontend -> algorithm/LLM`。跨域对象使用冻结合同或显式 mapper，避免循环依赖。Phase 1 可先在 `algorithm/schemas` 定义领域 schema 并由 Backend DTO 映射；若未来建立共享 package，必须通过合同变更流程。

配置和 Secret 位于所有服务端业务组件之前：

```text
.env（本地 Secret Source，不提交）
  -> Config / Secret Layer（Zod、类型、redaction）
  -> Provider Factory / Backend composition root
  -> Algorithm / Backend

Frontend ----X----> Secret Layer
```

PR Review 只有 `src/pr-review/config/env.ts` 可读取 `process.env`。业务代码使用强类型 `config` 或由 composition root 注入的配置；Frontend 永远不能导入此 server-only 模块。详细变量生命周期和安全策略见 `06-environment-and-api-config.md`。

## 2. 运行时组件与数据流

1. Frontend 向 Backend 提交 DTO。
2. Backend 认证/授权、校验、创建 ReviewCase v1 和审计事件。
3. Backend 通过唯一入口 `ReviewEngine.review(input, context)` 启动/继续审核，不读取 prompt。
4. Algorithm graph 执行确定性规则、知识检索和 reviewer；所有输出经 schema validation。
5. routing 汇总风险、confidence、证据和失败状态，返回 auto-continue 或 human-review request。
6. Backend 持久化结果；需要人工时保存 graph execution reference 并进入对应队列。
7. 人工动作通过 Backend 校验角色、当前 stage 和 version，再恢复 graph。
8. 最终批准只进入 Publisher port。非生产环境强制 MockPublisher；HIGH 风险没有自动发布路径。

业务数据库是真实来源，LangGraph checkpoint 是执行状态来源，LangSmith 是可观测来源，三者以 caseId/version/runId/traceId 关联，互不替代。

## 3. Algorithm Domain

目录：`src/pr-review/algorithm/`

```text
graph/       审核图、节点和条件边
state/       graph-only state 与 reducer
agents/      Planner、五维 Specialist、Critic、Judge、Revision Agent
rules/       确定性规则、规则版本、冲突策略
retrieval/   Brand knowledge port、查询与 evidence snapshot
prompts/     reviewer prompt 模板与版本
routing/     聚合、confidence、risk routing、失败闭锁
schemas/     Zod schema 与领域类型（v1 frozen 基线）
evidence/    文本/图片/OCR/VLM evidence ports 与 snapshot（真实 OCR/VLM 为未来能力）
evaluation/  可复用预测 runner；不包含 benchmark 结果
```

### 3.1 职责

- LangGraph 审核图和阶段状态。
- Risk Classification、Rule Engine、LLM Reviewer。
- Brand Knowledge Retrieval、Evidence Grounding。
- Visual Reviewer、confidence、risk routing、revision 建议。
- Structured Output schema validation 和算法级 telemetry。

Algorithm 不负责 HTTP、数据库实现、UI、登录和页面展示，也不直接发布。

Provider-specific model 初始化集中在 `src/pr-review/algorithm/providers/`，reviewer 只能使用统一 factory，不得自行构造 Provider SDK。INFRA-001 提供 contract/mock；INFRA-002 提供 DeepSeek 与 Qwen adapters。OpenAI/Anthropic adapters 仍未实现。真实 reviewer prompt、schema 和调用策略属于 ALG-004。

### 3.2 稳定入口

```ts
interface ReviewEngine {
  review(
    input: ReviewEngineInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;
  resume(
    input: ResumeReviewInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;
}
```

- `ReviewEngineInput`：当前 case/version snapshot、内容/图片、当前 stage、策略版本；ALG-001 不包含 originalContent。
- `ReviewContext`：requestId、脱敏 scalar trace metadata、deadline、cancellation capability、依赖 ports；不得包含 HTTP request、数据库 client、Secret 或完整内容。
- `ReviewEngineOutput`：validated ReviewResult[]、nullable aggregate result、nextStage、human flag、interrupt descriptor、execution reference 和 typed failures。
- 调用具备确定的 timeout/cancellation；异常映射为 typed failure，不返回默认 approve。

Backend 只能调用稳定接口，不能 import graph node、reviewer、prompt 或 routing 内部实现。

### 3.3 决策顺序

1. 输入/schema 校验。
2. 确定性规则（可并行按维度执行）。
3. 检索品牌/事实证据并保存 snapshot。
4. 按内容/素材运行结构化 reviewer；独立 reviewer 可并行。
5. 聚合 issues：保留来源、取最高有效 severity、处理冲突。
6. 计算 riskLevel/confidence；confidence 必须记录方法与版本。
7. fail-closed routing：HIGH、MEDIUM、低 confidence、失败/证据不足均人工；只允许满足全部 policy 的 LOW 自动流转。
8. 生成建议但不覆盖内容。

## 4. Backend Domain

目录：`src/pr-review/backend/`

```text
api/          route/controller、middleware、error mapping
services/     use cases、事务、权限与 graph orchestration
repositories/ repository ports 及后续 adapters
publishers/   Publisher port、MockPublisher、显式生产 adapter
audit/        append-only audit service
auth/         identity、RBAC/ABAC policy
dto/          HTTP request/response schema 和 domain mapper
```

职责：提交/查询 Case、修改内容、人工审批、恢复 LangGraph、历史/版本/审计、MockPublisher、DTO、错误处理。Backend 不写 prompt，不自行判断风险；只执行 Algorithm 给出的结果与组织 policy 明示的路由约束。

关键一致性要求：

- revise 在单事务内校验 expectedVersion、创建新版本、写 ReviewAction、更新 Case。
- 人工动作使用 `Idempotency-Key`；重复请求不得重复恢复 graph。
- repository 使用乐观锁；冲突返回 `409 VERSION_CONFLICT`。
- graph resume 采用 outbox/idempotent job，避免数据库提交成功但恢复丢失。
- audit append-only；禁止普通 update/delete。
- API 错误统一为 `{ error: { code, message, details?, requestId } }`。

## 5. Frontend Domain

目录：`apps/pr-review-console/`。现仓库没有合适的前端工程，Phase 1 采用 React + TypeScript + Vite；Phase 0 仅设计和目录边界。

页面：Dashboard、Submission Page、Review Queue、Review Detail、Risk Evidence Panel、Revision Compare、Audit Timeline、Evaluation Dashboard。

Review Detail 必须展示当前/原始内容、riskLevel、confidence、issue category、风险 text span、reason、evidence、suggestion、历史版本及 approve/revise/reject/escalate。动作按钮由 Backend 返回的 allowedActions 和当前版本控制；提交动作携带 expectedVersion 和 reason，冲突后刷新而非静默覆盖。

Frontend 只调用 Backend API，不导入 Algorithm、不直接调用 LLM、不在浏览器持有 provider key、不自行重新计算风险。

## 6. Test & Evaluation Domain

### 6.1 `tests/pr-review/`：软件测试

- unit：schema、规则、路由、service、权限、mapper。
- graph：节点顺序、条件边、interrupt/resume、失败闭锁。
- integration：ReviewEngine + repository、持久化恢复、MockPublisher。
- API：DTO、鉴权、分页、错误、并发、幂等。
- regression：冻结 bug case 和 generate_post 不回归。

测试数据可以是明确标记的 synthetic fixture；不得把合成数据称为人工标注。

### 6.2 `evals/pr-review/`：模型评估

- `datasets/`：版本化 benchmark manifest，记录来源、许可、PII 处理和 label provenance。
- `baselines/`：规则/模型基线配置。
- `experiments/`：增强方案配置和可复现运行清单。
- `metrics/`：PRD 指标实现。
- `analysis/`：错误分析模板与生成结果（大结果通常不入库）。

software test 验证代码是否按合同工作；model evaluation 衡量预测质量。单元测试全绿不能证明 High-risk Recall 达标，评估波动也不应被伪造成确定性单测。

## 7. 状态、阶段与版本

建议阶段枚举：`REQUESTER_SELF_CHECK`、`OPERATOR_REVIEW`、`VISUAL_REVIEW`、`COMPLIANCE_REVIEW`、`RISK_ROUTING`、`MEDIA_MANAGER_APPROVAL`、`SCHEDULING`、`COMPLETED`、`REJECTED`、`ESCALATED`、`REVIEW_REQUIRED`。

Case 状态与 graph node 名分离，避免内部重构破坏 API。每个算法调用绑定唯一 `caseId + contentVersion + reviewRunId`。旧版本的结果不可挂到新版本；新版本可引用旧 evidence，但须记录引用关系和有效性检查。

## 8. 持久化概念模型

- `review_cases`：Case 当前快照、stage、version、execution ref、乐观锁。
- `content_versions`：不可变正文/图片/platform snapshot、作者、创建时间。
- `review_results` / `review_issues`：按 case/version/reviewer 保存。
- `evidence_items`：来源、内容快照、hash、score、检索/抓取时间。
- `review_actions`：append-only audit。
- `outbox_jobs`：graph resume/publish 的可靠投递。
- `evaluation_runs`：数据集/算法版本、状态与指标引用。

Phase 0 不选择具体数据库；repository port 隔离实现。生产实现必须支持事务、唯一约束和迁移。

## 9. Publisher 安全边界

```ts
interface Publisher {
  schedule(request: PublishRequest): Promise<PublishReceipt>;
}
```

默认绑定 MockPublisher，只记录意图。生产 adapter 必须同时满足：显式环境、服务账号权限、最终批准动作、非 HIGH、幂等键和审计。Algorithm 永远不可调用 publisher；不得直接复用现有 `schedulePost` 节点作为审核系统默认实现。

## 10. 可观测性与错误处理

- trace metadata：caseId、version、stage、reviewerType、rule/prompt/model/knowledge version；禁止记录未脱敏 secret。
- metrics：latency、token、cost、parse、retry、manual route、override。
- public typed failure taxonomy：`INVALID_INPUT`、`SCHEMA_VALIDATION_FAILED`、`DEPENDENCY_UNAVAILABLE`、`TIMEOUT`、`CANCELLED`、`REVIEWER_FAILED`、`INTERNAL_ERROR`。模型、检索、视觉、策略等具体来源由 `ReviewFailure.source/details` 保留；例如 model timeout 映射为 `TIMEOUT` + `MODEL`，schema parse 映射为 `SCHEMA_VALIDATION_FAILED`，依赖不可用映射为 `DEPENDENCY_UNAVAILABLE`。业务上的 policy block 是 routing decision，不伪装成成功，也不必作为独立异常 code。
- retry 仅针对可重试错误并限制次数；耗尽后进入人工，不改变为 LOW。

## 11. 接口演进与 ADR

`03-contracts.md` 是 v1 冻结基线。新增可选字段通常为兼容变更；重命名、删除、改变语义或枚举值处理方式属于破坏性变更，必须更新合同、schema、API 测试、消费者和迁移说明。架构重大选择（数据库、队列、RAG store、身份系统）在实现前写 ADR，不在 Phase 0 假定。

## 12. Docs-first Governance

所有代码任务遵循 `07-vibe-coding-workflow.md`：先创建任务 Change Log、更新所有受影响 Domain 文档和必要 Contracts，输出 `DOCS GATE: PASS`，再实现。自动 `pr-review:docs:check` 只验证 working tree 中 code/docs co-change，是第二道保险，不能替代人工执行顺序。

Domain 详细边界位于 `docs/pr-review/domains/`。跨 Domain 任务必须在代码前修改所有相关文档；实现发现设计变化时停止代码、追加设计变化、重新过 Gate。

## 13. Social Data / Social Context Architecture

Social Data 只为 Reputation Review 提供外部语境：

```text
Social Platform
  -> Platform Adapter
  -> Normalization
  -> Social Context Store
  -> Retrieval
  -> SocialContextProvider
  -> Reputation Reviewer
```

- Adapter 负责平台差异与合法 access mode；Normalization 冻结 SocialPost/SocialComment。
- Store/Retrieval 生成包含 freshness、coverage、provider status 和 evidenceIds 的 `SocialContextSnapshot`。
- Reputation Reviewer 只能依赖 `SocialContextProvider`，不能调用微博、小红书、抖音、哔哩哔哩或酷安 API。
- 平台不可用是显式 typed failure/partial coverage，不伪装成“无讨论”。
- Social evidence 支持风险提示，不替代 Fact Reviewer 或最终人工判断。
- DATA-001 冻结文档级接口和 fixture/test 策略；ALG-001 仅将纯 Social 数据 schema 与 Algorithm-facing `SocialContextProvider` 落为 runtime contract。`SocialDataAdapter` runtime port、真实/fixture Adapter、Store、检索和账号接入均未实现，留给 DATA-002 独立 Docs Gate。

详细合规、隐私、平台状态与 fixture 策略见 `domains/social-data.md`。

## 14. PRODUCT-001 五维多智能体架构

本节覆盖第 3 节中 v1.0 reviewer 命名，但不删除 ALG-001 public contract。业务一级维度固定为 `PUBLIC_RELATIONS`、`OPERATIONS`、`PRODUCT`、`CUSTOMER`、`COMPLIANCE_SAFETY`；Visual 是跨模态证据能力，不是第六个 Specialist。

```text
input_validation
  -> content_understanding
  -> review_planner
  -> evidence_planning
  -> [public_relations_review | operations_review | product_review
      | customer_review | compliance_safety_review]（并行）
  -> evidence_critic
  -> decision_judge
  -> policy_guard
  -> revision_agent | await_human_review | complete_review
```

### 14.1 节点职责

- `input_validation`：使用冻结 Zod schema 验证 snapshot；失败形成 typed failure。
- `content_understanding`：产生确定性内容摘要/特征，不调用真实模型。
- `review_planner`：输出 `ReviewPlan`；五维至少 LIGHT，合规安全不得跳过。
- `evidence_planning`：按 plan 调用注入的 evidence ports，将返回值转换为 schema-valid snapshot/`EvidenceItem`。
- 五个 Specialist：互相独立并行，输出唯一维度的 `DimensionReviewResult`。
- `evidence_critic`：检查证据引用、unsupported conclusion、缺失证据和跨维冲突。
- `decision_judge`：执行 AI-style 深度综合，输出 `JudgeRecommendation`；本轮为 deterministic mock。
- `policy_guard`：应用 typed policy、hard gates 与 fail-closed 规则，生成 `FinalReviewDecision`。
- `revision_agent`：生成问题、原因、修改方向和可选建议正文，不改写 state 中的当前正文。
- `await_human_review`：创建 `InterruptDescriptor` 并通过 checkpoint 等待 resume。
- `complete_review`：仅封装已通过 Guard 的最终结果。

### 14.2 Graph state 与依赖注入

State 仅保存 input、内容理解、plan、evidence snapshot/IDs、五维结果、critic、judge、final decision、revision proposal、typed failures、revision count、execution reference 和 pending interrupt。并行维度结果与 failures 使用 reducer；每个 case/thread 隔离。

Provider client、API key、HTTP Request/Response、数据库 client、Frontend state 与 Secret 不得进入 state 或 checkpoint。`ReviewContext.dependencies` 只暴露 Algorithm-facing ports，graph invoke 时从 runtime context 使用，持久化的仅是经过 schema 验证且可审计的证据快照。开发 checkpoint 使用 LangGraph `MemorySaver`；它不替代 Backend durable repository。

### 14.3 Multimodal Evidence Layer

```text
Text + Image + OCR + VLM + Video keyframes（future）
                         -> EvidenceItem
                         -> 五个 Specialist Agent
```

图片文字或视觉线索必须按业务含义映射到一个或多个 `ReviewDimension`。真实 OCR/VLM、视频解析与远程素材访问均不属于本轮；模拟 evidence 必须标记为 synthetic/contract-only。素材不可用但 plan 要求视觉证据时进入 HUMAN_REVIEW。

### 14.4 Judge 与确定性安全边界

Decision Judge 负责跨维推理、主要风险排序和修改优先级；Policy Guard 负责可配置权重/阈值与 hard gate。Guard 可以把 Judge 的 PASS 收紧为 REVISE、HUMAN_REVIEW 或 BLOCK，禁止反向放宽。任何 reviewer/schema/evidence/state failure 不得变成 PASS。

### 14.5 Interrupt、resume 与 revision

`review()` 通过 MemorySaver 建立 execution/thread；需要人工时返回 interrupt。`resume()` 支持 APPROVE、REJECT、ESCALATE、REVISE：REVISE 只接受调用方提供的新正文 snapshot、增加 `revisionCount` 并重新进入规划审核；达到 policy 上限后停止自动循环并升级人工。Backend 后续仍负责权限、幂等、持久化与创建不可变 ContentVersion。

### 14.6 可观测性与隐私

保留 LangGraph/LangSmith 可追踪能力，但测试不依赖网络。`TRACE_CONTENT_ENABLED=false` 时自定义 metadata 不包含正文、PII、证据原文或 Secret；只记录 case/version、节点、schema/policy/algorithm 版本和脱敏 correlation IDs。本轮 DeepSeek、Qwen、真实 Social API 与 Publisher 调用均为零。

## 15. SPRINT-004 Business Foundation 架构

SPRINT-004 在既有五维 Mock Graph 之上补齐业务基础能力，但仍保持依赖方向：

```text
Frontend / CLI / WorkBuddy Adapter（future）
             |
             v
Backend API DTO / Controller Skeleton
             |
             v
Backend Services
   |         |         |
   v         v         v
Repositories EvidenceSnapshot ReviewEngine port
                         |
                         v
Algorithm Graph / RAG / LLM Agents
                         |
                         v
Provider Factory + Evidence Ports
```

Backend 不实现风险判断、不写 prompt、不直接构造 DeepSeek/Qwen provider。Algorithm 不导入 Backend repository implementation；需要历史可回放证据时，由 Backend 通过 `EvidenceSnapshot` 固定 `caseId + version + executionId + knowledgeVersion + socialContextVersion + evidenceItems`。

### 15.1 Backend API Foundation

BE-001 只冻结并实现 DTO、Zod validation、route/controller skeleton、typed error envelope、pagination、content-type 与 request size 校验。所有未来消费者只依赖 `/api/reviews` 与 `/api/evaluations/latest` 的稳定合同。

### 15.2 Repository / Version / Audit Foundation

BE-002 引入可替换 repository ports 与 InMemory adapter。`ContentVersion` 不可变；`ReviewAction` append-only；`expectedVersion` 执行 optimistic locking；REVISE transaction 必须保证创建新版本与追加 action 同成同败。生产数据库、durable checkpoint 与 outbox 留给后续 Backend task。

### 15.3 Social Context MVP

DATA-002 的运行时数据流为：

```text
local_fixture / authorized_export
          -> SocialDataAdapter
          -> Normalization
          -> Deduplication
          -> SocialContextBuilder
          -> SocialContextProvider
          -> PUBLIC_RELATIONS / CUSTOMER Evidence
```

该层不抓取真实平台、不绕过平台控制。provider unavailable 与成功空结果必须区分。社媒讨论只作为 reputation/customer concern evidence，不自动成为产品事实结论。

### 15.4 Benchmark Phase A

TEST-004 Phase A 提供 dataset schema、manifest、loader、metrics 与 validate command。它验证评测资产一致性，不调用真实模型。dev split 可用于 prompt 调优；test split 不得被反复读取结果后修改 prompt。

### 15.5 ALG-004 依赖与 Real AI Enablement

ALG-004 在 BE-002 与 TEST-004 Phase A 完成前保持 BLOCKED。依赖满足后，它实现本地版本化 Knowledge Base、BM25 + simple vector + RRF、KnowledgeRetriever、Agent Tool Boundary、Role Model Policy、LLM structured agents、executionMode（mock/hybrid/real）、prompt versioning、LangSmith 安全 metadata 与 headless `reviewContent(...)` facade。
