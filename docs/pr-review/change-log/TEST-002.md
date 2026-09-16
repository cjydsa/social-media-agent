# TEST-002 变更日志

`Documentation status: pre-implementation`（文档状态：实现前设计）

## 实现前设计（Pre-Implementation Design）

### 任务编号（Task ID）

TEST-002 — 五维 Multi-Agent Graph / Policy / Regression Suite

### 背景（Background）

PRODUCT-001/ALG-002/ALG-003 引入多节点、并行、评分和安全门禁，需要在实现前冻结 deterministic test matrix，避免根据当前 graph 行为反向决定期望。

### 当前行为（Current behavior）

TEST-001 已有 58 个合同测试；尚无 multi-agent、graph、policy、interrupt/resume 或 scenario tests。

### 期望行为（Desired behavior）

在 `tests/pr-review/algorithm/` 分离 contract extension、planner/specialists、policy、graph/engine tests。所有 scenario 为明确 `synthetic`/contract-only，固定输入得到固定输出，不接外网。

### 预计修改文件（Files expected to change）

文档：本 Change Log、Test/Algorithm Domain、Contracts、Plan/Board。

测试预计：

- `tests/pr-review/algorithm/fixtures.ts`
- `tests/pr-review/algorithm/multi-agent-contracts.test.ts`
- `tests/pr-review/algorithm/planner-specialists.test.ts`
- `tests/pr-review/algorithm/policy-guard.test.ts`
- `tests/pr-review/algorithm/review-engine.test.ts`
- existing `tests/pr-review/contracts/enums.test.ts` additive enum expectation updates

### 接口变更（Interface changes）

无生产接口；测试只通过 public barrel/ReviewEngine 入口，除 graph structure 单测外不 import node internals。

### 状态与 Schema 变更（State/schema changes）

测试 fixture 使用唯一 caseId/threadId；scenario resolver 在 engine 外注入。断言 state 不共享且 provider clients/Secret/HTTP/DB 不出现在 checkpoint-visible state。

### 错误处理（Error handling）

所有 injected throw、invalid schema、missing evidence、conflict、low confidence 必须断言非 PASS。测试失败不能通过削弱 Contract 或移除 hard gate 修复。

### 测试计划（Test plan）

1. normal → PASS。
2. pr-risk → not PASS。
3. unsupported product claim → not PASS。
4. customer expectation risk → REVISE 或 HUMAN_REVIEW（MVP 固定为 REVISE）。
5. compliance critical → never PASS。
6. operations-only moderate → REVISE。
7. missing evidence → HUMAN_REVIEW。
8. specialist conflict → HUMAN_REVIEW。
9. reviewer failure → fail closed。
10. weighted score low + hard blocker → never PASS。
11. Planner 始终包含五维且 COMPLIANCE_SAFETY 至少 LIGHT。
12. 返回恰好五个唯一 DimensionReviewResults。
13. riskScore 边界 0/100 pass，越界 fail。
14. Judge PASS 不能覆盖 Policy Guard blocker。
15. Revision output 包含 issue、reason、direction，且不覆盖 currentContent。
16. DeepSeek/Qwen/Social API/Publisher 调用均为 0；tracing 禁网。
17. 两个 case state/thread 隔离。
18. 相同 fixture 输出 deterministic（忽略 execution correlation IDs 后相同）。
19. interrupt/resume：APPROVE/REJECT/ESCALATE/REVISE shape 与最小行为；revision 超上限 HUMAN_REVIEW/BLOCK，不无限循环。
20. existing TEST-001 与全部 PR Review source tests 回归通过。

### 验收标准（Acceptance criteria）

- 所有 20 项预定义矩阵有 focused coverage。
- unit/graph/engine tests 分文件且 deterministic。
- 不调用真实 LLM、Social、Publisher、LangSmith network。
- typecheck、Prettier、focused/all tests、四 docs checks、diff check 通过。

### 不在范围内（Out of scope）

模型质量 benchmark、真实 prompt/provider、Backend/API/E2E、真实 OCR/VLM/社媒、生产 checkpoint/load/security tests。

## 设计变更（Design changes）

当前无设计变更；后续只允许追加。

## Implementation Result（实施结果）

2026-08-31 本轮完成 TEST-002 代码测试基线：

- 已新增 algorithm focused tests，覆盖 multi-agent contracts、Planner/Specialists、Policy Guard、ReviewEngine graph/resume、RevisionAgent。
- 测试 fixture 均为 synthetic / contract-only，不使用真实社媒数据。
- 已覆盖 normal PASS、pr-risk not PASS、product unsupported claim never PASS、customer risk REVISE、compliance critical never PASS、operations-only REVISE、missing evidence HUMAN_REVIEW、specialist conflict HUMAN_REVIEW、reviewer failure fail closed、低加权分但 hard blocker never PASS。
- 已覆盖 Planner 始终包含五维和 `COMPLIANCE_SAFETY`、五个唯一 `DimensionReviewResult`、riskScore bounds、Judge 不能绕过 Policy Guard、revision output 包含 issue/reason/direction、不调用真实 API、state isolation、deterministic fixture results。
- 已追加 ALG-001 enum regression，确认新增 v1.1 enum values 与旧 contract tests 共存。

## Validation Evidence（验证证据）

- 代码前已运行并通过：`yarn pr-review:docs:check --task TEST-002`。
- Focused TEST-002：5 suites / 37 tests 通过。
- PR Review source regression：13 suites / 134 tests 通过。
- `node node_modules/typescript/bin/tsc --noEmit` 通过。
- 直接匹配 `tests/pr-review` 时 Jest 会误命中 `dist/tests/pr-review` 旧编译产物；最终回归使用 `--testPathIgnorePatterns=dist` 限定 source tests。
