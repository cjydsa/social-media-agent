# PHASE-0 Change Log

`Documentation status: backfilled during DOCS-GATE-001`

`Backfilled after implementation during DOCS-GATE-001`

## Requirement

在不大规模实现业务代码的前提下，完成现状分析、PRD、技术架构、跨模块合同、开发计划、项目看板、工程规则与目录骨架，为 Frontend、Backend、Algorithm、Test/Evaluation 并行开发建立边界。

## Design decision

- 保留现有 `generate_post`、Agent Inbox、发布和 tracing 行为。
- 新系统采用 Frontend → Backend → Algorithm 的单向依赖。
- Backend 只通过 `ReviewEngine` 调用 Algorithm；Frontend 只调用 Backend API。
- 软件测试与模型质量评估分离；开发环境使用 MockPublisher。

## Docs

- `docs/pr-review/00-current-system-analysis.md`
- `docs/pr-review/01-PRD.md`
- `docs/pr-review/02-architecture.md`
- `docs/pr-review/03-contracts.md`
- `docs/pr-review/04-development-plan.md`
- `docs/pr-review/05-project-board.md`
- 根目录及各 Track 的 `AGENTS.md`

## Code files

仅创建 `src/pr-review/`、`apps/pr-review-console/`、`tests/pr-review/`、`evals/pr-review/` 的目录说明、局部 `AGENTS.md` 和 placeholder；没有新增审核业务运行时。

## Tests

Phase 0 以文档、路径与现有行为回归检查为主，没有新增业务测试。

## Result

产品边界、四个开发域、v1 合同、任务依赖和里程碑已建立；ALG-001 尚未开始。

## Known limitation

当时尚未建立集中配置、Provider adapter、Domain 文档、任务 Change Log 或自动 Docs Gate。

## Follow-up

INFRA-001、INFRA-002、DOCS-GATE-001、DATA-001，以及后续 ALG-001 + TEST-001。
