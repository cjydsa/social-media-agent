# TEST-004 — Public Content Review Benchmark v1 Phase A

Documentation status: pre-implementation

## Task ID

TEST-004

## 背景

当前软件测试可以验证 schema、graph 与 deterministic behavior，但还不能衡量 AI 审核质量。SPRINT-004 需要建立 Public Content Review Benchmark v1 的 Phase A：dataset schema、manifest、loader、metrics 与 validate command。

## 当前行为

- `evals/pr-review/README.md` 为评测目录占位。
- 尚无 dataset schema、manifest、loader、metrics 或 `yarn pr-review:eval:validate`。
- ALG-004 development plan 曾引用模糊的 “TEST-004 dataset manifest”，本任务将其规范为唯一事实源。

## 期望行为

实现 Public Content Review Benchmark v1 Phase A：

- dataset schema。
- dataset manifest。
- loader。
- metric implementations。
- baseline runner interface。
- `yarn pr-review:eval:validate`。

第一版数据集目标 100~150 条高质量 case；若 Sprint 时间不足，至少完成 60 条 development cases。质量优先于数量。

## 预计修改文件

### 文档

- `docs/pr-review/change-log/TEST-004.md`
- `docs/pr-review/domains/test-and-evaluation.md`
- `docs/pr-review/03-contracts.md`
- `docs/pr-review/04-development-plan.md`
- `docs/pr-review/05-project-board.md`
- `evals/pr-review/README.md`

### 代码 / 数据

- `evals/pr-review/schemas.ts`
- `evals/pr-review/dataset/**`
- `evals/pr-review/loader.ts`
- `evals/pr-review/metrics/**`
- `evals/pr-review/validate.ts`
- `scripts/pr-review-eval-validate.ts`
- `package.json`

### 测试

- `tests/pr-review/evaluation/dataset.test.ts`
- `tests/pr-review/evaluation/metrics.test.ts`

## 接口变化

新增：

- `BenchmarkCase`
- `BenchmarkManifest`
- `BenchmarkSplit`
- `BenchmarkProvenance`
- `BenchmarkRunCaseResult`
- `BenchmarkMetrics`
- `BenchmarkRunner`

每个 Case 至少包含：

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

## 状态 / Schema 变化

- split 至少包含 `dev` 与 `test`。
- prompt 调优允许使用 dev。
- test split 不得在反复查看结果后修改 prompt。
- provenance 必须明确为 `synthetic`、`manually_curated` 或 `authorized_export`。
- synthetic 不得声称为真实人工标注数据。

## Metrics 公式

### Dimension Precision

`正确预测的维度数 / 预测的维度总数`。若预测为空且标签为空，定义为 1；预测为空但标签非空，定义为 0。

### Dimension Recall

`正确预测的维度数 / 标注维度总数`。若标注为空且预测为空，定义为 1；标注为空但预测非空，定义为 0。

### Dimension F1

`2 * precision * recall / (precision + recall)`。precision 与 recall 同时为 0 时定义为 0。

### Macro-F1

对五个 `ReviewDimension` 分别计算 one-vs-rest F1 后求平均。

### High-risk Recall

`被正确识别为高风险的高风险 case 数 / 标注高风险 case 总数`。

### High-risk False Pass Rate

`标注高风险但系统输出 PASS 的 case 数 / 标注高风险 case 总数`。

### Decision Accuracy

`最终 decision 与 expectedDecision 一致的 case 数 / case 总数`。

### Manual Review Rate

`输出 HUMAN_REVIEW 的 case 数 / case 总数`。

### Evidence Coverage

`满足 requiredEvidence 的 case 数 / 需要 evidence 的 case 总数`。

### Evidence Citation Precision

`可匹配到有效 evidence 的引用数 / 总 evidence 引用数`。

### Schema Parse Success Rate

`schema parse 成功的 case 输出数 / case 总数`。

### Average Latency

所有 case latencyMs 的算术平均值。

### P95 Latency

latencyMs 升序排列后第 95 百分位值。

### Average Input Tokens

所有 case inputTokens 的算术平均值。

### Average Output Tokens

所有 case outputTokens 的算术平均值。

### Average Cost per Case

所有 case estimatedCost 的算术平均值；`null` 成本不参与平均，全部为 `null` 时返回 `null`。

## 校验规则

- case ID 全局唯一。
- dev/test 不得出现相同 normalized content。
- expectedDimensions 不得包含未知维度。
- expectedIssues 不得包含未知 issue category。
- expectedSeverity 必须为冻结 severity。
- requiredEvidence 必须为数组。
- provenance 必须存在。
- manifest caseCount 必须等于实际 case 数。

## 错误处理

- validate command 任一校验失败必须非零退出。
- metric 输入缺失必要字段必须 schema fail。
- 不得硬编码评测指标结果。

## 测试计划

- dataset schema legal/illegal。
- manifest caseCount。
- duplicate ID fail。
- split leakage fail。
- label completeness。
- provenance completeness。
- metric toy cases：precision/recall/F1、high-risk recall、false pass、decision accuracy、manual review、coverage、latency、token、cost。
- `yarn pr-review:eval:validate` 不调用真实模型。

## 验收标准

- 至少 60 条 development cases。
- manifest、loader、metrics、validate command 可运行。
- focused TEST-004 tests 通过。
- 不调用真实 LLM。

## 非目标

- 不跑真实模型 benchmark。
- 不优化 prompt。
- 不声称 synthetic 是真实数据。
- 不生成虚假业务指标。

## Implementation Result

完成 Public Content Review Benchmark v1 Phase A：

- 新增 benchmark schemas。
- 新增 dataset manifest。
- 新增 loader。
- 新增 metrics implementation。
- 新增 validate command：`yarn pr-review:eval:validate`。
- 新增 81 条 synthetic benchmark cases：
  - 72 条 dev。
  - 9 条 test。
- 覆盖 NORMAL、PUBLIC_RELATIONS、OPERATIONS、PRODUCT、CUSTOMER、COMPLIANCE_SAFETY、MULTI_RISK、MISSING_EVIDENCE、AGENT_CONFLICT。
- 未调用真实 LLM，未生成 baseline 质量结果。

## Validation Evidence

- EVAL focused tests：2 suites / 4 tests PASS。
- `yarn pr-review:eval:validate` PASS（提升权限用于 tsx/esbuild 子进程）。
- 全部 PR Review tests：18 suites / 157 tests PASS（direct Jest，忽略 `dist` 构建产物）。
- TypeScript：`node node_modules/typescript/bin/tsc --noEmit` PASS。
- Docs Gate：`yarn pr-review:docs:check --task TEST-004` PASS（提升权限用于脚本内部 `git status`）。
