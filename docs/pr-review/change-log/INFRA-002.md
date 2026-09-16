# INFRA-002 Change Log

`Documentation status: backfilled during DOCS-GATE-001`

`Backfilled after implementation during DOCS-GATE-001`

## Requirement

在既有 config 架构上增加 DeepSeek 与 Qwen Provider 支持，并提供默认不调用真实 API 的显式 smoke 命令。

## Design decision

- `LLMProvider` 支持 `mock | deepseek | qwen | openai | anthropic`。
- DeepSeek 使用 `@langchain/deepseek`；Qwen 使用 `@langchain/openai` 的 OpenAI-compatible client 与显式 `QWEN_BASE_URL`。
- adapter 只从 `config.llm` 接收 Secret；Reviewer 不读取 Key、不直接构造 SDK client。
- `LLM_MODEL` 是唯一模型标识来源；示例使用 `deepseek-v4-flash`，代码不硬编码默认模型。
- smoke 脚本只有在对应配置完整时才发起一次短请求，且不输出 prompt、response 或 Key。

## Docs

- `docs/pr-review/06-environment-and-api-config.md`
- `docs/pr-review/02-architecture.md`
- `docs/pr-review/04-development-plan.md`
- `docs/pr-review/05-project-board.md`
- 根目录、Algorithm 与 Config `AGENTS.md`

## Code files

- `src/pr-review/config/**`
- `src/pr-review/algorithm/providers/{deepseek,qwen,index,types}.ts`
- `scripts/pr-review-provider-smoke.ts`
- `scripts/pr-review-smoke-{deepseek,qwen}.ts`
- `.env.pr-review.example`
- `tests/pr-review/config/**`
- `package.json`、`yarn.lock`

## Tests

覆盖 DeepSeek/Qwen 条件校验、safe config 脱敏、doctor 脱敏、Frontend 边界和 factory dependency injection；测试不消费真实 API。

## Result

DeepSeek/Qwen 已能通过统一 factory 构造 LangChain chat model，并沿用 LangSmith 环境配置。真实 smoke 请求默认不执行。

## Known limitation

尚未实现 Reviewer、structured-output schema 或业务 graph；Qwen Base URL 必须由部署环境显式提供。

## Follow-up

DOCS-GATE-001、DATA-001 完成后进入 ALG-001 + TEST-001。
