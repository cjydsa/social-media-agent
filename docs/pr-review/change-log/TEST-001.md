# TEST-001 变更日志

`Documentation status: pre-implementation`（文档状态：实现前设计）

## 实现前设计（Pre-Implementation Design）

### 任务编号（Task ID）

TEST-001 — Contract 与 Schema 测试基线

### 背景（Background）

ALG-001 将引入首套可执行的 v1 领域合同。后续 Algorithm 与 Backend 工作开始前，需要确定性的 contract suite，以便立即发现 schema 漂移、宽松吞弃未知字段、Unicode span 错误和 fail-open failure 处理。

### 当前行为（Current behavior）

`tests/pr-review/` 当前只覆盖集中配置/provider 与 docs gate，尚无 domain enums、ReviewCase/Result/Action、ReviewEngine contracts、typed failures 或 DATA-001 runtime Social schemas 的测试。

### 期望行为（Desired behavior）

在 `tests/pr-review/contracts/` 新增 focused Jest tests，只断言已批准的 Contracts 行为。测试统一从 `src/pr-review/algorithm/index.ts` public barrel 导入，使用确定性的 contract fixtures，不依赖 graph、reviewer、API 或网络实现。

### 预计修改文件（Files expected to change）

测试代码前先修改以下文档：

- `docs/pr-review/change-log/TEST-001.md`
- `docs/pr-review/03-contracts.md`
- `docs/pr-review/05-project-board.md`
- `docs/pr-review/domains/test-and-evaluation.md`

Docs Gate 通过后预计修改：

- `tests/pr-review/contracts/fixtures.ts`
- `tests/pr-review/contracts/enums.test.ts`
- `tests/pr-review/contracts/review-case.test.ts`
- `tests/pr-review/contracts/review-result.test.ts`
- `tests/pr-review/contracts/review-action.test.ts`
- `tests/pr-review/contracts/review-engine.test.ts`
- `tests/pr-review/contracts/social-contract.test.ts`

### 接口变更（Interface changes）

TEST-001 不新增 production behavior 或 HTTP interface。测试只消费 ALG-001 public barrel，并编译 structural fake `ReviewEngine`/`SocialContextProvider`，证明消费者不需要 graph、reviewer、Backend 或 platform internals。

### 状态与 Schema 变更（State/schema changes）

本任务不创建运行状态。Contract-only fixtures 与冻结 strict schemas 一致。只有当对象本身包含 fixture provenance 时，Social fixture 才标记 `synthetic`；其他对象明确描述为 contract-only values，绝不称为真实平台数据或人工标注数据。

### 验证规则（Validation rules）

所有 pass/fail 预期来自 Contracts 第 1、2、5、6 节和 ALG-001 validation policy：

- 每个合法 enum value pass；unknown value fail。
- 合法 ReviewCase pass；`version=0`、invalid timestamp、top-level unknown field、nested submitter unknown field fail。
- ReviewResult 接受 confidence `0`/`1`，拒绝 `-0.01`/`1.01`；拒绝 negative latency、token、estimated cost 和大于 `1` 的 evidence score。
- standalone span structure 拒绝 negative start 与 `end <= start`。
- contextual validation 接受 ASCII、中文和 emoji/surrogate-pair UTF-16 span，拒绝 quote mismatch 和超出 `currentContent.length` 的 end。
- strict validation 拒绝 top-level 和固定 nested public object 的未知字段。
- 合法 typed failure pass；unknown code 与非 boolean `retryable` fail。
- 合法 schema 经过 `parse -> JSON.stringify -> JSON.parse -> parse` 后语义保持一致。
- SocialPost required fields、platform/access mode、timestamp、nullable unknown engagement、SocialContext coverage 和 Algorithm-facing provider port 均有用例。Unavailable coverage/status 必须显式表达；测试不得把成功空结果标为 provider unavailable。

### 错误处理（Error handling）

负例必须断言 Zod rejection，不通过放宽 schema 来适配非法 fixture。任何 throw 都不得解释为 approval 或 empty success。测试不调用真实 LLM、社媒平台、publisher 或业务 API。

### 测试计划（Test plan）

1. **Enum tests**：遍历所有批准的 public domain 与 Social enum values（包括命名导出的 `SocialMediaType`、`SocialProviderStatus`），并拒绝未知字符串。
2. **ReviewCase tests**：合法 parse、positive version、ISO timestamp、strict top-level/nested、JSON round trip。
3. **ReviewResult tests**：全部 numeric boundaries、strict nested model usage/evidence/issues、structural spans、ASCII/中文/emoji contextual UTF-16 spans、mismatch/out-of-range、JSON round trip。
4. **ReviewAction tests**：合法 actions、strict actor、REVISE increment invariant、invalid timestamp。
5. **ReviewEngine tests**：验证 input/context/output/resume/interrupt/execution，编译 public `ReviewEngine`，拒绝 unknown fields，验证 failure taxonomy，并对 serializable schemas 执行 JSON round trip。
6. **Social tests**：required/nullability/enum/time/count、strict nested objects、显式 unavailable provider coverage、JSON round trip，以及 fake `SocialContextProvider` 编译测试。
7. 运行 focused TEST-001 Jest、全部现有 PR Review Jest suites、typecheck、Prettier、两个 docs checks 与 `git diff --check`。

### 验收标准（Acceptance criteria）

- 所有预先设计的正反 contract cases 均确定性通过。
- 测试只通过稳定 Algorithm public barrel 导入。
- 未来 enum/field/nullability/strict/span/failure drift 会使对应测试失败。
- 现有 PR Review tests 保持通过。
- 无测试调用真实 model、platform、publisher、crawler 或 API；不引入伪造的 human-labeled/real social data。

### 不在范围内（Out of scope）

BE-001 未来 9 个 endpoints 的 API compatibility tests、Algorithm graph/rule/reviewer/routing behavior、interrupt/resume workflow execution、provider quality、model evaluation、benchmark data、Backend/Frontend/E2E、DATA-002 Adapter contract suites 和真实社媒数据。

### 实现前审核摘要

- TEST-001 只验证合同，不验证尚不存在的 Agent 行为。
- 测试矩阵已在实现前覆盖 enum、strict、边界数值、UTF-16、failure、round trip 和 Social contracts。
- 所有测试 fixture 都是 contract-only 或明确 synthetic，不会接触真实外部系统。
- Docs Gate 通过前不修改任何 test 文件。

## 设计变更（Design changes）

### 2026-08-31 — 补充命名 Social enum 用例（非破坏性）

因 ALG-001 将 DATA-001 已有内联 union 正式命名导出为 `SocialMediaType` 与 `SocialProviderStatus`，TEST-001 在代码前明确为两者增加合法全集与 unknown value 用例。未改变取值或其他测试预期。

### 2026-08-31 — 补充 SocialSearchInput 边界用例

ALG-001 reconciliation 暂停后，测试计划追加 SocialSearchInput 正反例：合法非空 query/正整数 limit pass；空白 query、limit `0`、非整数 limit fail。预期来自 DATA-001 empty query error 与本次 Contracts runtime 澄清，不根据当前实现反向放宽或推断。

实现中如发现其他必须改变的测试计划，须先在此追加记录并重新通过 Docs Gate。

## 实现结果（Implementation Result）

- 在 `tests/pr-review/contracts/` 新增 6 个 focused suites 和 contract-only fixture builders。
- 覆盖全部 public domain/Social enum 合法全集与 unknown values。
- 覆盖 ReviewCase version/timestamp/strict/round-trip，ReviewResult 数值/strict/UTF-16/round-trip，ReviewAction REVISE invariant，ReviewEngine input/context/output/resume/failure/public port，以及 Social required/nullability/time/count/query/coverage/provider port。
- ASCII、中文与 emoji surrogate pair span 均验证 `currentContent.slice(start,end)`；mismatch、out-of-bounds、negative start、`end <= start` 均 fail。
- fake SocialContextProvider 只返回 contract-only snapshot；测试未调用 DeepSeek、Qwen、真实社媒或 Publisher。

## 验证证据（Validation Evidence）

- Focused TEST-001：`node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --testPathPatterns=tests/pr-review/contracts --testPathIgnorePatterns=dist`，6 suites / 58 tests 通过。
- Existing + new source PR Review regression：显式 `LANGSMITH_TRACING=false`，8 suites / 87 tests 通过。
- TypeScript direct typecheck、Stage A Prettier check、`git diff --check` 均通过。
- 实际 `yarn pr-review:docs:check --task TEST-001` 最终 PASS；沙箱内 Yarn/tsx 的 `spawn EPERM` 使用获准的沙箱外同命令处理并如实记录。
- ts-jest 仍输出仓库既有 NodeNext/`isolatedModules` warning；测试通过，未修改无关 tsconfig。
- 初次全量命令因 pattern 过宽误选 `dist`，其失败不计为源回归通过；修正后的精确源测试结果如上。误运行期间 LangSmith capability probe 超时，无成功调用；后续验证全部显式关闭 tracing。
