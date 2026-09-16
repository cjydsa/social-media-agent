# Docs-first Vibe Coding 工作流

本规范是 PR Review 子系统后续开发的最高优先级工程流程。它约束人和 Codex：**任何源码、测试、脚本或运行时配置修改之前，必须先修改描述该变更的 Markdown。** 发现文档不足时必须停止实现，先补设计，而不是依据当前代码反向编写预期。

## 1. 适用范围与硬规则

- 每个任务必须先创建 `docs/pr-review/change-log/<TASK-ID>.md`，写完并保留 `Pre-Implementation Design`。
- 修改某个 Domain 的代码前，必须修改对应 `docs/pr-review/domains/*.md`；跨 Domain 任务先修改所有受影响文档。
- Schema、DTO 或 API 改动还必须先修改 `docs/pr-review/03-contracts.md`。
- 实现中的新想法不能直接进入代码；先追加 Design changes，再重新通过 Gate。
- `scripts/pr-review-docs-gate.ts` 只检查同一 working tree 中是否有必要的文档变化，不能证明文件修改的时间先后。人工流程和 `AGENTS.md` 才是第一道 Gate。
- 历史任务 PHASE-0、INFRA-001、INFRA-002 的记录明确标为 `Backfilled after implementation during DOCS-GATE-001` 的等价指定状态；自 DOCS-GATE-001 起不得 backfill。

## 2. 每个 Task 的执行顺序

### STEP 1 — Read

开始任务前完整读取：

- `01-PRD.md`
- `02-architecture.md`
- `03-contracts.md`
- 当前受影响的 Domain 文档
- `04-development-plan.md`
- `05-project-board.md`
- 根目录和目标目录的 `AGENTS.md`

同时检查 working tree，识别用户已有改动并避免覆盖。

### STEP 2 — Docs Plan

在修改任何源码前，创建或更新相关 Markdown。Change Log 的 `Pre-Implementation Design` 必须至少写明：

- Task ID
- Background
- Current behavior
- Desired behavior
- Files expected to change
- Interface changes
- State/schema changes
- Error handling
- Test plan
- Acceptance criteria
- Out of scope

Domain 文档描述稳定边界和当前设计；Change Log 保存本次任务的原始设计。后续设计变化采用追加记录，禁止覆盖原设计来制造“一直一致”的假象。

### STEP 3 — Docs Gate

源码修改前必须向用户输出：

```text
DOCS GATE: PASS
```

并列出修改了哪些 Markdown、为什么需要修改、即将修改哪些代码、分别对应文档哪一节。

若本任务没有任何 Markdown 变化，必须输出：

```text
DOCS GATE: FAIL
```

并停止，不得修改源码。自动命令 `yarn pr-review:docs:check --task <TASK-ID>` 是实现后的第二道保险，不替代这一顺序。

### STEP 4 — Implementation

只实现已通过 Gate 的设计。若发现接口、Schema、流程、错误策略、文件范围或测试计划必须变化：

1. 立即停止实现；
2. 返回 STEP 2；
3. 在 Change Log 的 Design changes 追加原因与新决定；
4. 更新受影响 Domain/Contracts 文档；
5. 重新输出 Docs Gate 结果后继续。

### STEP 5 — Test

只按 STEP 2 已定义的 Test plan 验证。允许补充更严格的用例，但不得在实现完成后根据当前行为反向决定预期，也不得削弱测试来接受缺陷。软件测试与 AI quality evaluation 始终分离。

### STEP 6 — Reconciliation

完成后逐项核对：

```text
Docs ↔ Contracts ↔ Code ↔ Tests
```

确认字段、错误、边界、依赖方向和验收证据不存在漂移。将实际结果追加到 Change Log 的 `Implementation Result`；不重写 Pre-Implementation Design。

### STEP 7 — Project Board

按真实状态更新 `05-project-board.md`。只有 Acceptance criteria、Tests 和 Definition of Done 均满足时才能进入 DONE；阻塞原因必须显式记录。

## 3. Domain 与文档映射

| Code scope                                  | Required Domain doc                                          | Additional required doc                       |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `src/pr-review/algorithm/**`                | `domains/algorithm.md`                                       | Schema/公共 port 变化时更新 `03-contracts.md` |
| `src/pr-review/backend/**`                  | `domains/backend.md`                                         | endpoint/DTO 变化时更新 `03-contracts.md`     |
| `apps/pr-review-console/**`                 | `domains/frontend.md`                                        | 只能消费已冻结的 Backend API/DTO              |
| `tests/pr-review/**`, `evals/pr-review/**`  | `domains/test-and-evaluation.md`                             | 合同用例变化时更新 `03-contracts.md`          |
| PR Review Social Connector/Adapter          | `domains/social-data.md`                                     | Schema/port 变化时更新 `03-contracts.md`      |
| `src/pr-review/config/**`, provider factory | `06-environment-and-api-config.md` 与 `domains/algorithm.md` | 新变量/公共类型同步 Architecture/Change Log   |

所有任务还必须有本任务 Change Log。上表是最低要求，不限制跨 Domain 任务增加文档。

## 4. 审查清单

- 文档是否先于本轮代码变化完成？
- 是否保留原始设计和后续设计变化？
- 所有受影响 Domain 是否有文档变化？
- 公共合同是否先冻结、消费者是否没有自行扩展？
- 测试预期是否来自文档而非当前实现？
- Project Board 是否反映真实状态？
- 是否未触碰任务 Out of scope？
