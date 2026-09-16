# Environment and API Configuration

## 1. Scope and scan result

INFRA-001 scanned committed `.env` examples, README, `package.json`, `langgraph.json`, `process.env` references, model constructors, LangSmith, Firecrawl, Arcade, social clients, GitHub, Slack, Supabase, scripts, and tests.

- A real root `.env` did **not** exist at scan time. No secret values were read or printed.
- Existing `.env.quickstart.example` and `.env.full.example` remain unchanged.
- `.gitignore` already ignores `.env` and `.env.*`, while allowing `.env.example` and `.env.*.example`. This covers `.env.local` and `.env.*.local` without deleting local files.
- Legacy code reads environment variables directly in many modules. INFRA-001 does not refactor those clients.
- New PR Review business code must receive typed config and must not read `process.env`; only `src/pr-review/config/env.ts` may read it.

## 2. Variable inventory

“Required Phase” is the earliest phase that may use a variable, not a promise that its integration is implemented. “Required/Optional” is scoped to the selected provider. Shared means the legacy app already uses the name and PR Review accepts it through centralized config.

| Variable                           | Provider                   | Existing/New                  | Required Phase                | Required/Optional                              | Secret          | Purpose                                                                  |
| ---------------------------------- | -------------------------- | ----------------------------- | ----------------------------- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                         | Application                | Existing/shared               | INFRA-001                     | Optional; defaults development                 | No              | Select development/test/production safety policy                         |
| `PR_REVIEW_API_PORT`               | PR Review                  | New                           | Backend MVP                   | Optional; defaults 3001                        | No              | Backend HTTP port                                                        |
| `PR_REVIEW_MAX_REVISION_COUNT`     | PR Review                  | New                           | Algorithm/Backend MVP         | Optional; defaults 3                           | No              | Maximum revision loop before escalation                                  |
| `LLM_PROVIDER`                     | PR Review                  | New                           | INFRA-001/002                 | Optional; defaults mock                        | No              | Select mock, deepseek, qwen, openai, or anthropic                        |
| `LLM_MODEL`                        | Selected LLM               | New                           | RAG & LLM Reviewer            | Required only for non-mock use                 | No              | Central model ID; no reviewer-level hard-coded default                   |
| `PR_REVIEW_EXECUTION_MODE`         | PR Review                  | New                           | ALG-004                       | Optional; defaults mock for keyless local runs | No              | Select `mock`, `hybrid`, or `real` review execution mode                 |
| `PR_REVIEW_PLANNER_PROVIDER`       | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_PROVIDER`         | No              | Planner role provider                                                    |
| `PR_REVIEW_PLANNER_MODEL`          | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_MODEL`            | No              | Planner role model                                                       |
| `PR_REVIEW_SPECIALIST_PROVIDER`    | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_PROVIDER`         | No              | Five Specialist roles provider                                           |
| `PR_REVIEW_SPECIALIST_MODEL`       | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_MODEL`            | No              | Five Specialist roles model                                              |
| `PR_REVIEW_CRITIC_PROVIDER`        | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_PROVIDER`         | No              | Evidence Critic role provider                                            |
| `PR_REVIEW_CRITIC_MODEL`           | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_MODEL`            | No              | Evidence Critic role model                                               |
| `PR_REVIEW_JUDGE_PROVIDER`         | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_PROVIDER`         | No              | Decision Judge role provider                                             |
| `PR_REVIEW_JUDGE_MODEL`            | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_MODEL`            | No              | Decision Judge role model                                                |
| `PR_REVIEW_REVISION_PROVIDER`      | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_PROVIDER`         | No              | Revision Agent role provider                                             |
| `PR_REVIEW_REVISION_MODEL`         | PR Review role policy      | New                           | ALG-004                       | Optional; falls back to `LLM_MODEL`            | No              | Revision Agent role model                                                |
| `DEEPSEEK_API_KEY`                 | DeepSeek                   | New                           | INFRA-002                     | Required only for deepseek                     | Yes             | Official `@langchain/deepseek` adapter authentication                    |
| `DASHSCOPE_API_KEY`                | Alibaba Cloud Model Studio | New                           | INFRA-002                     | Required only for qwen                         | Yes             | Authenticate Qwen through the OpenAI-compatible endpoint                 |
| `QWEN_BASE_URL`                    | Alibaba Cloud Model Studio | New                           | INFRA-002                     | Required only for qwen                         | No              | Explicit regional/workspace compatible Base URL; never hard-coded        |
| `OPENAI_API_KEY`                   | OpenAI                     | Existing implicitly/shared    | RAG & LLM Reviewer            | Required only for openai                       | Yes             | Future OpenAI review adapter authentication                              |
| `ANTHROPIC_API_KEY`                | Anthropic                  | Existing/shared               | RAG & LLM Reviewer            | Required only for anthropic                    | Yes             | Future Anthropic review adapter authentication                           |
| `LANGSMITH_API_KEY`                | LangSmith                  | README existing/new canonical | Optional observability        | Optional; production tracing requires it       | Yes             | Authenticate PR Review tracing                                           |
| `LANGSMITH_TRACING`                | LangSmith                  | New canonical                 | Optional observability        | Optional; defaults false                       | No              | Enable PR Review tracing intent                                          |
| `LANGSMITH_PROJECT`                | LangSmith                  | New                           | Optional observability        | Optional; non-secret default                   | No              | Isolate PR Review traces                                                 |
| `TRACE_CONTENT_ENABLED`            | PR Review/LangSmith        | New                           | Optional observability        | Optional; defaults false                       | No              | Explicit content tracing gate after privacy review                       |
| `RETRIEVAL_PROVIDER`               | PR Review                  | New                           | RAG & LLM Reviewer            | Optional; local in v1                          | No              | Select local Markdown/JSON/BM25/vector retrieval                         |
| `FIRECRAWL_API_KEY`                | Firecrawl                  | Existing/shared               | Future URL ingestion          | Optional                                       | Yes             | Optional webpage acquisition; local review works without it              |
| `VISUAL_REVIEW_ENABLED`            | PR Review                  | New                           | Multimodal                    | Optional; defaults false                       | No              | Enable visual review                                                     |
| `VISUAL_PROVIDER`                  | PR Review                  | New                           | Multimodal                    | Optional; defaults mock                        | No              | Select mock or reuse the selected multimodal LLM                         |
| `PUBLISHER_MODE`                   | PR Review                  | New                           | Backend MVP                   | Optional; defaults mock                        | No              | Requested publisher mode; no real adapter in INFRA-001                   |
| `REAL_PUBLISHING_ENABLED`          | PR Review                  | New                           | Future production integration | Optional; defaults false                       | No              | Second production-only publishing gate                                   |
| `EVAL_DATASET_PATH`                | PR Review Evaluation       | New                           | Evaluation                    | Optional; local default                        | No              | Versioned local evaluation dataset path                                  |
| `LANGCHAIN_API_KEY`                | Legacy LangGraph/LangSmith | Existing legacy               | Legacy only                   | Required by some legacy deployed graph flows   | Yes             | Legacy SDK/trace authentication; not needed by PR Review mock/local mode |
| `LANGCHAIN_TRACING_V2`             | Legacy LangSmith           | Existing legacy               | Legacy only                   | Optional                                       | No              | Legacy tracing flag; not PR Review canonical flag                        |
| `LANGGRAPH_API_URL`                | LangGraph Server           | Existing legacy               | Legacy/future deployment      | Optional for PR Review INFRA/MVP               | No              | Legacy graph server location                                             |
| `LANGGRAPH_ASSISTANT_ID`           | LangGraph Server           | Existing legacy               | Legacy only                   | Optional                                       | No              | Slack messaging graph selection                                          |
| `PORT`                             | LangGraph/legacy           | Existing legacy               | Legacy only                   | Optional                                       | No              | Legacy runtime port                                                      |
| `ARCADE_API_KEY`                   | Arcade                     | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy social OAuth/tool execution                                       |
| `USE_ARCADE_AUTH`                  | Arcade                     | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Switch legacy social authentication                                      |
| `TWITTER_USER_ID`                  | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | No              | Legacy target identity                                                   |
| `TWITTER_API_KEY`                  | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy app credential                                                    |
| `TWITTER_API_KEY_SECRET`           | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy app secret                                                        |
| `TWITTER_BEARER_TOKEN`             | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy read token                                                        |
| `TWITTER_CLIENT_ID`                | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Treat as secret | Legacy OAuth identity                                                    |
| `TWITTER_CLIENT_SECRET`            | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy OAuth secret                                                      |
| `TWITTER_USER_TOKEN`               | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy user token                                                        |
| `TWITTER_USER_TOKEN_SECRET`        | X/Twitter                  | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy user token secret                                                 |
| `TWITTER_MAIN_USER_TOKEN`          | X/Twitter                  | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Legacy automatic reshare token                                           |
| `TWITTER_MAIN_USER_TOKEN_SECRET`   | X/Twitter                  | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Legacy automatic reshare secret                                          |
| `USE_TWITTER_API_ONLY`             | X/Twitter                  | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Legacy read/auth routing                                                 |
| `LINKEDIN_USER_ID`                 | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | No              | Legacy Arcade identity                                                   |
| `LINKEDIN_CLIENT_ID`               | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | Treat as secret | Legacy OAuth identity                                                    |
| `LINKEDIN_CLIENT_SECRET`           | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy OAuth secret                                                      |
| `LINKEDIN_ACCESS_TOKEN`            | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | Yes             | Legacy publishing credential                                             |
| `LINKEDIN_PERSON_URN`              | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | No              | Legacy publishing identity                                               |
| `LINKEDIN_ORGANIZATION_ID`         | LinkedIn                   | Existing legacy               | Future social integration     | Not required by PR Review                      | No              | Legacy organization target                                               |
| `LINKEDIN_MAIN_ACCESS_TOKEN`       | LinkedIn                   | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Legacy reshare credential                                                |
| `LINKEDIN_MAIN_ORGANIZATION_ID`    | LinkedIn                   | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Legacy main organization target                                          |
| `POST_TO_LINKEDIN_ORGANIZATION`    | LinkedIn                   | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Legacy target switch                                                     |
| `SLACK_BOT_OAUTH_TOKEN`            | Slack                      | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Legacy ingestion/notifications                                           |
| `SLACK_BOT_USER_OAUTH_TOKEN`       | Slack                      | Existing legacy code          | Legacy only                   | Not required by PR Review                      | Yes             | Legacy user-scoped operation                                             |
| `SLACK_BOT_TOKEN`                  | Slack                      | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Messaging service token                                                  |
| `SLACK_TOKEN`                      | Slack                      | Existing legacy code          | Legacy only                   | Not required by PR Review                      | Yes             | Legacy curation token                                                    |
| `SLACK_SIGNING_SECRET`             | Slack                      | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Verify Slack requests                                                    |
| `SLACK_CHANNEL_ID`                 | Slack                      | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Ingestion/notification channel                                           |
| `SUPABASE_URL`                     | Supabase                   | Existing legacy               | Future storage decision       | Not required by PR Review                      | No              | Legacy image storage endpoint                                            |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase                   | Existing legacy               | Future storage decision       | Not required by PR Review                      | Yes             | Legacy privileged storage key                                            |
| `GITHUB_TOKEN`                     | GitHub                     | Existing legacy               | Future evidence connector     | Not required by PR Review                      | Yes             | Legacy repository content access                                         |
| `GOOGLE_VERTEX_AI_WEB_CREDENTIALS` | Google Vertex AI           | Existing legacy               | Future visual provider        | Not required by PR Review                      | Yes             | Legacy image/video credentials                                           |
| `REDDIT_CLIENT_ID`                 | Reddit                     | Existing legacy code          | Legacy only                   | Not required by PR Review                      | Treat as secret | Legacy client identity                                                   |
| `REDDIT_CLIENT_SECRET`             | Reddit                     | Existing legacy code          | Legacy only                   | Not required by PR Review                      | Yes             | Legacy Reddit secret                                                     |
| `SESSION_SECRET`                   | Legacy OAuth server        | Existing legacy               | Legacy only                   | Not required by PR Review                      | Yes             | Legacy session protection                                                |
| `SKIP_CONTENT_RELEVANCY_CHECK`     | Legacy generate-post       | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Bypass legacy relevancy check                                            |
| `SKIP_USED_URLS_CHECK`             | Legacy generate-post       | Existing legacy               | Legacy only                   | Not required by PR Review                      | No              | Bypass legacy URL deduplication                                          |
| `TEXT_ONLY_MODE`                   | Legacy generate-post       | Existing legacy code          | Legacy only                   | Not required by PR Review                      | No              | Disable legacy image processing                                          |
| `USE_LANGCHAIN_PROMPTS`            | Legacy generate-post       | Existing legacy code          | Legacy only                   | Not required by PR Review                      | No              | Select legacy LangChain prompts                                          |

## 3. What is required now

INFRA-001 and ALG-001 run with **no API keys**. These safe values are defaults:

```dotenv
NODE_ENV=development
LLM_PROVIDER=mock
RETRIEVAL_PROVIDER=local
VISUAL_REVIEW_ENABLED=false
VISUAL_PROVIDER=mock
PUBLISHER_MODE=mock
REAL_PUBLISHING_ENABLED=false
LANGSMITH_TRACING=false
TRACE_CONTENT_ENABLED=false
```

A real LLM requires exactly one selected provider key plus `LLM_MODEL`; Qwen also requires its region/workspace `QWEN_BASE_URL`. DeepSeek examples use the current `deepseek-v4-flash` identifier. OpenAI is not required for DeepSeek or Qwen. Firecrawl and LangSmith remain optional. Social, Slack, Supabase, GitHub, Reddit, and Vertex credentials are not required to start PR Review.

ALG-004 的推荐开发策略是 `hybrid`：deterministic rules + real LLM reviewers/judge。为了保留无 key 本地测试能力，配置默认仍为 `mock`；启用 `hybrid` 或 `real` 时必须为被选中的 role provider 配置对应 key/model。推荐但不可硬编码的 role policy：

```dotenv
PR_REVIEW_EXECUTION_MODE=hybrid
PR_REVIEW_PLANNER_PROVIDER=deepseek
PR_REVIEW_PLANNER_MODEL=deepseek-v4-flash
PR_REVIEW_SPECIALIST_PROVIDER=deepseek
PR_REVIEW_SPECIALIST_MODEL=deepseek-v4-flash
PR_REVIEW_CRITIC_PROVIDER=qwen
PR_REVIEW_CRITIC_MODEL=
PR_REVIEW_JUDGE_PROVIDER=qwen
PR_REVIEW_JUDGE_MODEL=
PR_REVIEW_REVISION_PROVIDER=deepseek
PR_REVIEW_REVISION_MODEL=deepseek-v4-flash
```

Qwen role 仍需要 `DASHSCOPE_API_KEY` 与 `QWEN_BASE_URL`。不得把任一 role 的 provider/model 写死在 Agent 实现中。

## 4. Configuration lifecycle

```text
.env (local secret source, never committed)
  -> dotenv at the process entry point
  -> config/env.ts Zod parsing
  -> typed config + redacted SecretValue
  -> provider factory / Backend composition root
  -> Algorithm and Backend dependencies

Frontend ----X----> server config / process.env / provider keys
```

- `config` is the normal process singleton; `loadConfig(source)` enables deterministic keyless tests.
- `getSafeConfig()` includes providers, model, flags, ports, paths, and only configured/missing booleans. It excludes credentials.
- `SecretValue` redacts string, JSON, and Node inspection output. Only a future server provider adapter may unwrap a key at the SDK boundary.
- Reviewers must use `createReviewModel(config.llm)` instead of constructing provider SDK clients.

## 5. Validation and safety behavior

- Mock LLM needs no key/model. Every real provider is checked immediately before adapter creation and requires only its matching key plus `LLM_MODEL`; Qwen additionally requires `QWEN_BASE_URL`.
- DeepSeek uses the official `@langchain/deepseek` `ChatDeepSeek` integration, preserving LangChain structured output, tool calling, usage metadata/callbacks, and automatic LangSmith tracing capabilities.
- Qwen uses `@langchain/openai` `ChatOpenAI` with an explicit `configuration.baseURL` and DashScope key. Model Studio endpoints, keys, and model availability vary by region, so there is no Base URL default.
- LangSmith defaults off. In development/test, enabled tracing without a key produces a doctor warning; in production it is a validation error. This supports local keyless tests without accepting misleading production observability.
- `TRACE_CONTENT_ENABLED=false` remains independent. Metadata must never contain secrets; full content/PII tracing requires explicit enablement and privacy review.
- Firecrawl absence does not block local retrieval. Visual review defaults disabled/mock and requires no OCR key.
- Effective real publishing requires production, real mode, and the explicit enable flag. Outside production it is always false. INFRA-001 includes no real adapter.
- `PR_REVIEW_EXECUTION_MODE=real` 或 `hybrid` 只授权模型审核路径，不授权真实社媒抓取或真实 Publisher。Social Context 仍只能使用 DATA-002 合法 access mode。
- Role Model Policy 的 safe config 只暴露 provider/model/configured/missing 状态，不输出 secret。

## 5.1 ALG-004 controlled smoke policy

真实 DeepSeek/Qwen smoke 只能在所有 unit tests、docs checks 与配置校验通过后手动执行。每个 provider 最多 5 条 case，输出仅包含 provider、model、success、schemaParse、latency、token usage。不得输出 key、prompt、完整正文或完整 evidence。

## 5.2 SPRINT-005 server / upload / auth / seed variables

SPRINT-005 引入 Full-Stack Console 的 composition root 配置，全部有安全默认值，无 key 也可启动：

| Variable                | Default        | Secret | Purpose                                                             |
| ----------------------- | -------------- | ------ | ------------------------------------------------------------------- |
| `PR_REVIEW_API_PORT`    | `3001`         | No     | HTTP server bind port（既有变量，SPRINT-005 复用为唯一监听端口）    |
| `PR_REVIEW_SERVER_HOST` | `127.0.0.1`    | No     | HTTP server bind host                                               |
| `PR_REVIEW_UPLOAD_DIR`  | `data/uploads` | No     | `POST /api/uploads` 落盘目录（相对 repo root；禁止路径穿越）        |
| `PR_REVIEW_AUTH_MODE`   | `dev-header`   | No     | 身份提供者；目前唯一合法值 `dev-header`（开发身份，非生产安全模型） |
| `PR_REVIEW_DEMO_SEED`   | `true`         | No     | repository 为空时注入标注 synthetic 的演示 Case                     |

约束：

- 这些变量仍只能由 `src/pr-review/config/env.ts` 读取，业务代码使用 typed config。
- `PR_REVIEW_AUTH_MODE` 未来新增生产模式（如 OIDC）时必须经过独立合同与 ADR；dev-header 不得宣称生产级认证。
- 上传目录只保存用户主动上传的素材文件，不保存 secret；文件名由服务端随机生成。
- safe config/doctor 输出包含上述 host/port/dir/mode/seed，不含任何凭据。

## 5.3 SPRINT-006 vision 变量

| Variable                   | Default | Secret | Purpose                                             |
| -------------------------- | ------- | ------ | --------------------------------------------------- |
| `PR_REVIEW_VISION_PROVIDER` | `mock`  | No     | 视觉分析 provider；`qwen` 走 DashScope 视觉模型     |
| `PR_REVIEW_VISION_MODEL`    | （空）   | No     | 视觉模型 ID；qwen 时建议 `qwen-vl-plus`             |

仅在 `hybrid` 执行模式且 vision provider 非 mock、模型与 `DASHSCOPE_API_KEY`/`QWEN_BASE_URL` 完整时启用真实视觉分析；否则含图 Case 的 `MULTIMODAL_EVIDENCE` 记 missing 并强制人工（fail closed）。

## 6. Local setup and doctor

Copy `.env.pr-review.example` to `.env` only when overrides or credentials are needed. Never edit or commit another user's `.env`.

```bash
yarn pr-review:config:check
```

The doctor prints only provider names, configured/missing status, flags, and diagnostics. It never prints key values. Invalid required provider configuration exits non-zero.

Explicit smoke commands are opt-in and call one short request only when the selected provider configuration is complete:

```bash
yarn pr-review:smoke:deepseek
yarn pr-review:smoke:qwen
```

They print provider, model, success/failure, latency, and token usage when returned. They do not print keys, prompts, or response bodies. Do not run them in CI or routine unit tests.

## 7. DeepSeek and Qwen configuration

DeepSeek:

```dotenv
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=
```

Qwen:

```dotenv
LLM_PROVIDER=qwen
LLM_MODEL=
DASHSCOPE_API_KEY=
QWEN_BASE_URL=
```

Obtain the exact Qwen Base URL and model ID from the same Alibaba Cloud region/workspace as the API key. Do not copy a URL from an unrelated region.

Provider references:

- [LangChain JS ChatDeepSeek integration](https://docs.langchain.com/oss/javascript/integrations/chat/deepseek)
- [DeepSeek current model list](https://api-docs.deepseek.com/api/list-models)
- [DeepSeek models and deprecation notice](https://api-docs.deepseek.com/quick_start/pricing/)
- [Alibaba Cloud Model Studio OpenAI-compatible access](https://www.alibabacloud.com/help/en/model-studio/what-is-model-studio)
- [Alibaba Cloud Model Studio model list](https://www.alibabacloud.com/help/en/model-studio/models)

## 8. Secret leak protection

INFRA tests verify mock mode without `.env`, provider-specific errors, dependency-injected SDK factories, safe serialization/inspection, doctor redaction, frontend isolation, centralized `process.env` access, common credential-shaped token patterns, and the development publisher guard. Unit tests never call a real model API. These lightweight checks complement CI/hosting secret scanners and production secret management.
