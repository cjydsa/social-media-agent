# DOCS-GATE-001 Change Log

`Documentation status: pre-implementation`

## Pre-Implementation Design

### Task ID

DOCS-GATE-001

### Background

Phase 0 与两项 INFRA 工作已有产品、架构和配置文档，但缺少按任务保存的不可回写设计记录、各 Domain 的前置设计入口，以及自动检测“代码变化但相关文档完全没有变化”的第二道保险。

### Current behavior

工程规则要求阅读 PRD/Architecture/Contracts，但没有统一的七步 Docs-first 工作流；历史任务无独立 Change Log；没有 `pr-review:docs:check`。

### Desired behavior

所有后续任务在源码前创建 Change Log 并更新所有受影响 Domain 文档；实现只能覆盖预先描述的内容。自动 Gate 基于当前 working tree 的文件变化检查任务 Change Log 和对应 Domain/Contracts 文档是否共同变化，但不宣称能验证 Git 时间顺序。

### Files expected to change

- Markdown：`docs/pr-review/07-vibe-coding-workflow.md`、`docs/pr-review/domains/**`、`docs/pr-review/change-log/**`、既有核心文档与所有 PR Review `AGENTS.md`
- Gate：`scripts/pr-review-docs-gate.ts`
- 测试：`tests/pr-review/docs-gate/**`
- 命令：`package.json`

### Interface changes

新增开发命令 `yarn pr-review:docs:check --task <TASK-ID>`。该命令是开发治理接口，不改变运行时 API。

### State/schema changes

无运行时 State 或业务 Schema 变化。

### Error handling

缺少 Task ID、无法读取 Git 状态、缺少任务 Change Log、或受影响 Domain/Contracts 文档未变化时，命令以非零状态退出并列出缺项；不读取 `.env`。

### Test plan

- 纯函数测试使用注入的 changed-file 列表，不启动 Git 子进程。
- 覆盖 Algorithm、Backend API、Frontend、Test/Evaluation、Social Data 映射。
- 覆盖缺 Task Change Log、缺 Domain 文档、完整文档、仅文档任务及无关文件。
- 运行真实 `yarn pr-review:docs:check --task DOCS-GATE-001` 验证当前 working tree。

### Acceptance criteria

- 七步工作流和所有 Domain Gate 有明确文档。
- 历史任务以指定文本标记为补档。
- 自动 Gate 对缺失文档 fail，对完整 co-change pass，并提供清晰输出。
- 不修改审核业务代码、legacy `generate_post` 或 Secret。

### Out of scope

不判断 commit 时间顺序；不实现 ALG-001、业务 API、页面、真实 Social Adapter、爬虫或 Publisher。

## Design changes

实现前如设计必须变化，仅在本节追加记录，不覆盖上述原始设计。

## Retrospective audit findings

- Phase 0 的 skeleton 与边界在 `00`–`05` 文档中已有说明，未发现审核业务被提前实现。
- INFRA-001/002 的 config、Secret、Provider、doctor、smoke 与测试行为在 `02`、`04`、`05`、`06` 中基本有对应说明，但此前没有独立任务 Change Log，也没有 Domain 前置设计记录；本轮按历史补档标识修复治理缺口。
- Social Listening/Social Context 过去只存在于 Reputation 的宽泛需求，没有 Schema、port、access mode 或 fixture/test 合同；DATA-001 在业务代码之前补齐设计，不声称已有实现。
- Project Board 的历史内容与新的强制顺序不一致；本轮将 ALG-001 重新阻塞到 DOCS-GATE-001、DATA-001 完成之后。
- 未发现现有 `generate_post` 行为在这些任务中被修改。无关未跟踪文件不纳入项目设计，也不读取或修改。

## Implementation Result

- Added `scripts/pr-review-docs-gate.ts` with a pure, dependency-injectable checker and a Git working-tree CLI.
- Added `tests/pr-review/docs-gate/docs-gate.test.ts` with 12 predesigned path/contract/parser cases.
- Added `yarn pr-review:docs:check --task <TASK-ID>`.
- The real working-tree check for DOCS-GATE-001 passed and found all required co-changed docs.
- Prettier, direct TypeScript typecheck, and the focused Jest suite passed. On this Windows workspace, Yarn's generated `tsc`/`cross-env` command shims were unavailable and sandboxed `tsx` received `spawn EPERM`; equivalent direct Node entries passed, and the CLI passed when rerun outside that sandbox restriction. No network or Secret access occurred.

No audit business code, legacy `generate_post`, Publisher, or Social Adapter was changed.

## Validation Evidence

- Prettier: passed for all changed governance Markdown, AGENTS, script, test, and package files.
- TypeScript: passed via `node node_modules/typescript/bin/tsc`.
- PR Review Jest: 2 suites / 29 tests passed with the repository's `.test.ts` selection semantics; DOCS Gate subset was 12 tests.
- `yarn pr-review:docs:check --task DOCS-GATE-001`: passed against the final working tree.
- `git diff --check`: passed; only Windows LF/CRLF conversion warnings were reported by later read-only diff commands.
- `generate_post`, `upload_post`, and `langgraph.json` diff: empty.
