# Test & Evaluation Domain

## 1. 边界

`tests/pr-review/` 验证软件确定性、合同、graph、API、回归与安全；`evals/pr-review/` 评估模型质量、benchmark、实验比较、指标与错误分析。**Software test != AI evaluation。** 单元测试不得依赖真实模型、真实平台 API 或真实 Publisher。

## 2. 当前行为

INFRA-001/002 已有集中配置、Secret 脱敏、Provider factory 与 smoke 安全测试。Algorithm、Backend、Frontend 的业务测试和 benchmark 尚未实现。现有 fixture placeholder 不代表真实采集或人工标注数据。

## 3. Docs-first Gate

修改 `tests/pr-review/**` 或 `evals/pr-review/**` 前必须先：

1. 在任务 Change Log 预先写 Test plan；
2. 修改本文对应测试设计；
3. 合同预期变化时先修改 `03-contracts.md`；
4. 输出 `DOCS GATE: PASS`。

测试不得根据完成后的实现反向定义预期，也不得把 synthetic fixture 描述成人工标注或真实平台数据。

## 4. DOCS-GATE-001 预先测试计划

docs gate 的核心检查器接受注入的 changed-file 列表，Jest 不启动 Git 子进程；CLI 层单独读取 `git status --porcelain`。预定义用例：

- Algorithm code + task Change Log + `domains/algorithm.md`：pass；缺任一项：fail。
- Backend API/DTO code 还需 `domains/backend.md` 和 `03-contracts.md`。
- Frontend code 需 `domains/frontend.md`。
- tests/evals code 需 `domains/test-and-evaluation.md`。
- PR Review Social Data code 需 `domains/social-data.md`；Schema/port 变化还需 Contracts。
- 仅文档任务在有对应 task Change Log 时 pass。
- 无 Task ID、Git 状态读取失败或缺文档时产生清晰非零结果。
- unrelated user files（例如不属于 PR Review 任务的归档）不被读取或修改。

自动检查只验证 co-change，不声称验证修改时间顺序。

## 5. DATA-001 Adapter Contract Test 设计

每个 future Adapter 必须运行相同合同套件，覆盖：

- required fields 与枚举；
- timestamp/时区归一化；
- malformed data 与 invalid response；
- duplicate post 的稳定去重；
- missing engagement 的 `null`/unknown 语义，不伪造 `0`；
- rate-limit error；
- provider unavailable；
- empty query；
- author identifier 脱敏与 provenance/accessMode 保留。

Contract tests 使用 `evals/pr-review/fixtures/social/<platform>/` 的固定合规 fixture 或 test-local mock。真实平台 API 不属于单元测试依赖。

## 6. Fixture 与评估真实性

Social fixture 必须逐项标记 `synthetic`、`manually_curated` 或 `authorized_export` provenance。`manually_curated` 仅表示人工整理，不等于 human-labeled ground truth。真实授权导出需要去除与审核无关的个人信息，且不得提交受限数据。

## 7. TEST-001 Contract & Schema 基线

TEST-001 只验证 ALG-001 冻结合同，不验证尚不存在的 Agent、graph、Backend endpoint、resume workflow 或模型质量。测试位于 `tests/pr-review/contracts/`，统一从 `src/pr-review/algorithm/index.ts` public barrel 导入。

### 7.1 Enum matrix

- ContentType、ReviewDecision、RiskLevel、IssueCategory、Severity、ReviewerType、ReviewActionType、ReviewStage 的每个合法值 pass；unknown fail。
- SocialPlatform、SocialAccessMode、FixtureProvenance、SocialMediaType、SocialProviderStatus 的每个合法值 pass；unknown fail。

### 7.2 ReviewCase matrix

- 完整合法 object pass，并执行 JSON round trip。
- `version=0` fail；invalid/无时区 timestamp fail。
- top-level unknown field fail；nested `submitter` unknown field fail。

### 7.3 ReviewResult matrix

- confidence `0`/`1` pass，`-0.01`/`1.01` fail。
- negative latency fail；negative/non-integer tokens fail；negative estimatedCost fail；score `>1` fail。
- top-level、issue、textSpan、evidence、modelUsage 的 unknown fields 分别 fail。
- 合法 object 执行 JSON round trip，nullability 保持。

### 7.4 UTF-16 textSpan matrix

- ASCII span pass。
- 中文字符 span pass。
- emoji/surrogate pair 使用两个 UTF-16 code units，正确 `[start,end)` pass。
- quote mismatch fail；`end > currentContent.length` fail。
- structural schema 对 negative start 和 `end <= start` fail。
- quote 和 bounds 只通过 `validateReviewResultAgainstContent` 测试，不错误归因给 standalone `ReviewIssueSchema`。

### 7.5 ReviewAction matrix

- 合法 action/timestamp pass；actor nested unknown fail。
- REVISE 的 version 相邻关系 pass；null version 或非 `+1` fail。

### 7.6 ReviewEngine/Failure matrix

- `ReviewEngineInput`、runtime `ReviewContext`、`ReviewEngineOutput`、Resume discriminated union、InterruptDescriptor、ExecutionReference 的合法形状 pass，unknown field fail。
- public import 可编译；structural fake engine 不导入 graph/reviewer/Backend。
- 合法 ReviewFailure pass；unknown code fail；`retryable` 非 boolean fail；details 只接受 JSON-safe value。
- output serializable 部分执行 JSON round trip；含 capability/function 的 runtime context 不声称 JSON transport compatibility。

### 7.7 Social schema matrix

- SocialPost required fields、platform/accessMode/mediaType、timestamp、strict nested objects 通过正反例验证。
- SocialSearchInput 接受合法非空 query/正整数 limit；空白 query、limit `0` 或非整数 fail。
- unknown engagement 使用 `null` pass；negative/non-integer count fail，不能以 schema coercion 把 unknown 变成 `0`。
- SocialContextSnapshot coverage 明确列出 requested/available/unavailable；partial/unavailable 不被描述成成功空讨论。
- fake `SocialContextProvider` 只返回 contract-only snapshot，不调用任何平台。
- fixtures 是 contract-only 或显式 `synthetic`，不声称真实采集或 human-labeled。

### 7.8 执行与完成门槛

运行 focused TEST-001 Jest、现有 PR Review tests、TypeScript typecheck、Prettier、两个 task docs check 与 `git diff --check`。任何合同差异先回 Docs Gate，不通过削弱测试解决。TEST-001 不包含 BE-001 未来 9 endpoints；其 API compatibility cases 在 BE-001/后续 TEST 任务按 Docs-first 添加。

## 8. TEST-002 五维 Multi-Agent 测试矩阵

所有 fixture 均为明确的 `synthetic` 或 contract-only 数据；测试关闭网络 tracing，不调用真实 LLM、Social、OCR/VLM 或 Publisher。

| 编号 | 场景                                   | 预期                                                 |
| ---- | -------------------------------------- | ---------------------------------------------------- |
| 1    | normal                                 | `PASS`                                               |
| 2    | pr-risk                                | 不得 PASS                                            |
| 3    | unsupported product claim              | 不得 PASS                                            |
| 4    | customer expectation risk              | MVP 固定为 `REVISE`                                  |
| 5    | compliance critical                    | 永不 PASS                                            |
| 6    | operations-only moderate               | `REVISE`                                             |
| 7    | required evidence missing              | `HUMAN_REVIEW`                                       |
| 8    | specialist conflict                    | `HUMAN_REVIEW`                                       |
| 9    | reviewer throw/invalid output          | typed failure 且 fail closed                         |
| 10   | weighted score 很低但命中 hard blocker | 永不 PASS                                            |
| 11   | Planner completeness                   | 五维均存在，`COMPLIANCE_SAFETY` 至少 LIGHT           |
| 12   | parallel results                       | 恰好五个不重复维度结果                               |
| 13   | riskScore                              | 0/100 pass，越界 fail                                |
| 14   | Judge/Guard                            | Judge PASS 不能覆盖 Guard blocker                    |
| 15   | Revision proposal                      | 包含 issue、reason、direction，不覆盖 currentContent |
| 16   | no real API                            | DeepSeek/Qwen/Social/Publisher 调用均为 0            |
| 17   | state isolation                        | 两个 case/thread 不共享状态                          |
| 18   | determinism                            | 相同 fixture 的业务输出一致                          |
| 19   | interrupt/resume/revision              | 四动作 shape 正确，revision 达上限不无限循环         |
| 20   | regression                             | TEST-001 与全部 PR Review source tests 继续通过      |

测试按 `multi-agent-contracts`、`planner-specialists`、`policy-guard`、`review-engine` 分文件。focused 验证之外还运行 TypeScript typecheck、Prettier、全部 PR Review tests、四个 docs checks 与 `git diff --check`。不得为了迎合实现而修改上述预期；设计需要变化时先追加 Change Log 并重新过 Docs Gate。

## 9. TEST-004 Public Content Review Benchmark v1 Phase A

TEST-004 Phase A 是 AI Evaluation 基础，不等同于软件单元测试。本阶段实现 dataset schema、manifest、loader、metrics 与 validate command；不调用真实 LLM，不调优 prompt，不输出 baseline 质量结论。

### 9.1 Dataset schema

每个 case 至少包含：

- `id`
- `content`
- `contentType`
- `platform`
- `expectedDecision`
- `expectedDimensions`
- `expectedIssues`
- `expectedSeverity`
- `requiredEvidence`
- `provenance`
- `notes`
- `split`

允许一个 case 多维度、多 issue。provenance 必须明确为 `synthetic`、`manually_curated` 或 `authorized_export`。synthetic 不得被描述为真实平台采集或人工标注 ground truth。

### 9.2 Coverage plan

第一版目标 100~150 条高质量 case；若 Sprint 时间不足，先完成不少于 60 条 development cases。建议覆盖：

- NORMAL
- PUBLIC_RELATIONS
- OPERATIONS
- PRODUCT
- CUSTOMER
- COMPLIANCE_SAFETY
- MULTI_RISK
- MISSING_EVIDENCE
- AGENT_CONFLICT

### 9.3 Split policy

- `dev`：允许用于开发、prompt 迭代与错误分析。
- `test`：不得在反复查看结果后修改 prompt 或标签。

manifest 必须记录 datasetVersion、createdAt、caseCount、split counts 与 provenance counts。loader 必须能按 split 读取。

### 9.4 Metrics

- Dimension Precision：`正确预测的维度数 / 预测的维度总数`。
- Dimension Recall：`正确预测的维度数 / 标注维度总数`。
- Dimension F1：`2 * precision * recall / (precision + recall)`。
- Macro-F1：对五个 ReviewDimension 分别计算 one-vs-rest F1 后求平均。
- High-risk Recall：`正确识别高风险 case 数 / 标注高风险 case 总数`。
- High-risk False Pass Rate：`标注高风险但输出 PASS 的 case 数 / 标注高风险 case 总数`。
- Decision Accuracy：`decision 与 expectedDecision 一致的 case 数 / case 总数`。
- Manual Review Rate：`HUMAN_REVIEW case 数 / case 总数`。
- Evidence Coverage：`满足 requiredEvidence 的 case 数 / 需要 evidence 的 case 总数`。
- Evidence Citation Precision：`可匹配有效 evidence 的引用数 / 总 evidence 引用数`。
- Schema Parse Success Rate：`schema parse 成功输出数 / case 总数`。
- Average Latency：latencyMs 平均值。
- P95 Latency：latencyMs 第 95 百分位值。
- Average Input Tokens：inputTokens 平均值。
- Average Output Tokens：outputTokens 平均值。
- Average Cost per Case：非 null estimatedCost 平均值；全部 null 时为 null。

不得预设或硬编码 86%、92% 等指标值。

### 9.5 Validate command

新增命令：

```text
yarn pr-review:eval:validate
```

该命令只验证 dataset consistency、schema validation、duplicate case IDs、split leakage、label completeness、provenance 与 metric toy cases，不调用真实模型。

### 9.6 TEST-004 Phase A tests

- dataset schema 正反例。
- manifest caseCount 与 split/provenance counts。
- duplicate case ID fail。
- dev/test normalized content leakage fail。
- label completeness。
- metric toy cases。
- validate command no real API calls。

## 10. SPRINT-004 focused test matrix

- BE-001：API DTO、error envelope、pagination、content-type、payload size、public handler import boundary。
- BE-002：repository port、ContentVersion immutable、ReviewAction append-only、optimistic locking、EvidenceSnapshot、revision transaction。
- DATA-002：adapter contract、empty result、provider unavailable、malformed input、dedupe、timestamp normalization、missing engagement、privacy/redaction。
- TEST-004：dataset/manifest/loader/metrics/validate。
- ALG-004：RAG retrieval、RoleModelPolicy、mocked structured provider、parse failure、timeout、missing evidence、facade。

所有 unit tests 真实 DeepSeek/Qwen/Social API/Publisher 调用数必须为 0。

## 11. SPRINT-005 focused test matrix

- orchestration（`tests/pr-review/backend/orchestration.test.ts`）：创建 -> 自动路由 stage；approve 按 12.7.6 推进；revise 原子 v+1 且对新版本重审；reject/escalate 终态；expectedVersion 冲突 409；重复 Idempotency-Key 不重复动作；engine 抛错 fail closed 进入 `REVIEW_REQUIRED` 且不产生 APPROVE。
- authorization（`tests/pr-review/backend/authorization.test.ts`）：12.7.1 角色×阶段矩阵正反例；提交者自我终审 APPROVE 禁止；SYSTEM_ADMINISTRATOR 无审批动作；allowedActions 与服务端 assert 一致；终态无动作。
- publisher（`tests/pr-review/backend/publisher.test.ts`）：默认 MockPublisher receipt；非 SCHEDULING stage 拒绝（INVALID_STAGE_ACTION）；非 MEDIA_MANAGER 拒绝（FORBIDDEN）；相同幂等键只排期一次；SCHEDULE action append-only；无真实发布调用。
- server API（`tests/pr-review/backend/server-api.test.ts`）：ephemeral 端口真实 HTTP 冒烟：uploads 正例（PNG 魔数）/反例（坏 MIME、超限、伪造魔数）、POST /api/reviews -> GET detail（含 allowedActions）-> approve -> revise -> history -> schedule；error envelope 形状与 requestId；缺失 actor header 401。
- Frontend：本轮以 `tsc --noEmit` 与 `vite build` 作为验收；组件/浏览器 E2E 属于 TEST-003，不在本轮。

SPRINT-005 所有测试真实 LLM/Social/Publisher 网络调用数必须为 0；HTTP 冒烟只走 127.0.0.1 ephemeral 端口。

## 12. SPRINT-006 focused test matrix

- hybrid graph（`tests/pr-review/unit/hybrid-graph.test.ts`）：注入 mock StructuredOutputModel（合法输出）→ 五维 LLM 分数与具体理由进入 dimensionResults 与 finalDecision；注入 schema 非法输出 → 该维度 fail closed + failures；注入 throw → REVIEWER_FAILED + 强制人工；mock 执行模式全程 LLM 调用数为 0。
- visual analysis（`tests/pr-review/unit/visual-analysis.test.ts`）：mock VLM 响应 → `MULTIMODAL_EVIDENCE` EvidenceItem 形状/数量/内容；VLM 失败 → missing + 强制人工；vision=mock 时不发请求。
- 既有测试零改动通过；真实模型只在手动 smoke/演示中出现。
