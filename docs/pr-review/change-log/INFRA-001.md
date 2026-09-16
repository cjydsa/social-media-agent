# INFRA-001 Change Log

`Documentation status: backfilled during DOCS-GATE-001`

`Backfilled after implementation during DOCS-GATE-001`

## Requirement

建立 PR Review 专用的集中式、类型安全配置与 Secret 管理；提供安全默认值、配置诊断、Mock Provider 和泄漏防护，不改造 legacy clients，不连接真实 Publisher。

## Design decision

- 仅 `src/pr-review/config/env.ts` 可读取 PR Review 环境变量。
- Secret 使用不可枚举、默认脱敏的 `SecretValue`，`getSafeConfig()` 不返回 Secret。
- Provider 配置按所选 provider 条件验证；mock/local 模式无 Key 可运行。
- development/test 中真实发布始终被安全门阻止。
- tracing 内容默认关闭，不主动把正文、PII 或 Secret 写入自定义 metadata。

## Docs

- `docs/pr-review/06-environment-and-api-config.md`
- `docs/pr-review/02-architecture.md`
- `docs/pr-review/04-development-plan.md`
- `docs/pr-review/05-project-board.md`
- 根目录与 `src/pr-review/config/AGENTS.md`

## Code files

- `src/pr-review/config/{env,types,providers,features,index}.ts`
- `src/pr-review/algorithm/providers/{types,mock,index}.ts`
- `scripts/pr-review-config-check.ts`
- `.env.pr-review.example`
- `tests/pr-review/config/**`
- `package.json`

## Tests

覆盖 mock 无 Key、条件 Key 校验、LangSmith 开关、Publisher 安全、safe config、doctor 脱敏、Frontend import 边界及无 `.env` 的 mock 启动。

## Result

PR Review 业务模块拥有统一 config 入口、Provider factory 基础合同和安全诊断命令。

## Known limitation

INFRA-001 只提供 Mock Provider；不执行真实模型或 Publisher 请求。

## Follow-up

INFRA-002 增加 DeepSeek/Qwen adapter；Algorithm reviewer 仍必须等待 ALG 任务。
