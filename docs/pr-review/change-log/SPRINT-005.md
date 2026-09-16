# SPRINT-005 — Full-Stack Console：Backend Orchestration、Auth、Publisher、HTTP Server、Uploads 与 Frontend MVP

Documentation status: pre-implementation

## Task ID

SPRINT-005（覆盖 board 上的 BE-003、BE-004、BE-005、FE-001、FE-002、FE-003、FE-004、INT-001 的 MVP 切片）

## 背景

SPRINT-004 完成后，Algorithm 五维多智能体引擎、RAG、结构化 LLM agent wrapper、Backend DTO、InMemory Repository 与 Benchmark Phase A 均已完成，但系统仍无法以「前后端分离产品」形态运行：

- 没有把 API DTO 与 ReviewEngine、Repository 串起来的 orchestration service（BE-003）。
- 没有身份与角色×阶段授权（BE-004）。
- 没有 Publisher port 与 MockPublisher（BE-005）。
- 没有任何可访问的 HTTP server（composition root / INT-001）。
- `apps/pr-review-console/` 仍是空目录（FE-001..FE-004）。
- 用户无法上传图片等多模态素材；contract 只有 `imageUrls` 字符串数组，没有产生 URL 的上传通道。

本轮目标是把系统交付为可一键运行的前后端分离公关审核产品：用户提交文案 + 图片 -> 五维 AI 审核 -> 人工动作（approve/revise/reject/escalate）-> 版本历史 -> Mock 排期，全程可在浏览器交互。

## 当前行为

- `POST /api/reviews` 等 9 个 endpoint 只有 DTO parse skeleton，无 service、无 HTTP listener。
- `InMemoryReviewRepository` 完整可用但无调用方。
- `createLangGraphReviewEngine()` / `reviewContent(...)` 可运行 deterministic 五维审核。
- ReviewCase stage 在创建后停留在 `REQUESTER_SELF_CHECK`，没有任何 stage 推进逻辑。
- 无 allowedActions 计算；DTO `ReviewDetailResponse` 未包含 allowedActions。
- 无上传 endpoint；无静态资源托管；无前端工程。

## 期望行为

### Backend Orchestration（BE-003 MVP）

- `ReviewOrchestrationService`：create -> 运行 engine -> 持久化 StoredReviewResult + EvidenceSnapshot -> 按 `output.nextStage`/`requiresHuman` 推进 stage -> append SUBMIT/AUTO_ROUTE audit。
- approve/revise/reject/escalate：校验 actor、stage、expectedVersion；优先通过 `engine.resume(...)` 恢复执行；当 execution 不在内存（如重启后）时，按合同 stage 转移表确定性推进并持久化 ReviewAction（失败语义不变：fail closed）。
- revise：复用 BE-002 `RevisionTransactionRepository.revise(...)` 原子创建 v+1 与 action，然后对新 version 重新运行 engine（对应 PRD「修订后重新审核」）。
- history：聚合 case、versions、actions、results、evidenceSnapshots。
- evaluations/latest：返回真实最新 benchmark run；无运行记录时 `latestRun: null`，不伪造指标。

### Auth（BE-004 MVP）

- 开发身份：HTTP header `x-actor-id` / `x-actor-name` / `x-actor-role`（`PR_REVIEW_AUTH_MODE=dev-header`，默认）。这是开发/演示身份提供者，不是生产安全模型；生产 OIDC/SSO 适配器留待后续任务。
- 角色枚举：`REQUESTER`、`ACCOUNT_OPERATOR`、`VISUAL_REVIEWER`、`COMPLIANCE_REVIEWER`、`MEDIA_MANAGER`、`SYSTEM_ADMINISTRATOR`。
- 角色×阶段动作矩阵（AuthorizationPolicy）：每个 stage 决定哪个角色可执行哪些动作；提交者不得对自己 Case 做最终关卡（MEDIA_MANAGER_APPROVAL）审批；管理员默认无内容审批权。
- Detail 响应 additive 返回 `allowedActions`；Frontend 只渲染 allowedActions。

### Publisher（BE-005 MVP）

- `Publisher` port + `MockPublisher`（只记录意图、返回 receipt）。
- `POST /api/reviews/:id/schedule`：仅 MEDIA_MANAGER、stage=`SCHEDULING`、非 HIGH 自动路径；带 `Idempotency-Key`；成功写 SCHEDULE action 并推进 `COMPLETED`。
- 真实 publisher 不在本轮范围；`REAL_PUBLISHING_ENABLED` 维持 false。

### Composition Root / HTTP Server（INT-001 MVP）

- `src/pr-review/server/`：Express app factory + 路由接线 + 错误 envelope 中间件 + requestId。
- `POST /api/uploads`：JSON `{ files: [{ fileName, mediaType, dataBase64 }] }`；限制：单次最多 5 个文件、单文件解码后 ≤ 5MB、MIME 白名单 `image/png|image/jpeg|image/gif|image/webp` 并做魔数嗅探；保存到 `PR_REVIEW_UPLOAD_DIR`（默认 `data/uploads/`，随机文件名防路径穿越）；返回 `{ data: { files: [{ url, fileName, size, mediaType }] } }`；`/uploads/*` 静态只读托管。
- 托管 `apps/pr-review-console/dist` 静态构建产物（SPA fallback），实现单端口交付；开发时 Vite proxy `/api`、`/uploads` 到 server。
- Demo seed：仓库为空且 `PR_REVIEW_DEMO_SEED=true`（默认）时注入明确标注 synthetic 的演示 Case，使首次启动即可浏览。

### Frontend（FE-001..FE-004 MVP）

- Vite + React + TypeScript，路由：Dashboard `/`、Submission `/submit`、Review Queue `/queue`、Review Detail `/reviews/:id`（含版本历史/diff、审计时间线 tab）、Evaluation `/evaluation`。
- Submission 支持文案 + 多平台选择 + 图片上传（拖拽/点击、预览、删除）+ 来源链接。
- Detail 展示：当前/原始内容、issue textSpan 高亮、五维 risk score、confidence、verdict、issues、evidence、Judge/Guard 结论、allowedActions 动作（reason 必填 modal、expectedVersion、409 后刷新）。
- 角色切换器（localStorage），所有请求携带 actor header。
- Evaluation 页：`latestRun` 为 null 时显式展示「未计算」；不写死任何指标。
- Frontend 不 import Algorithm、不持有任何 key、不自行计算风险。

## 预计修改文件

### 文档

- `docs/pr-review/change-log/SPRINT-005.md`
- `docs/pr-review/03-contracts.md`（additive 12.7）
- `docs/pr-review/domains/backend.md`
- `docs/pr-review/domains/frontend.md`
- `docs/pr-review/domains/test-and-evaluation.md`
- `docs/pr-review/domains/algorithm.md`（config 变化联动）
- `docs/pr-review/06-environment-and-api-config.md`（新增 server/upload/auth/seed 变量）
- `docs/pr-review/05-project-board.md`

### 代码（Backend / Server）

- `src/pr-review/backend/services/orchestration.ts`（新增）
- `src/pr-review/backend/services/authorization.ts`（新增）
- `src/pr-review/backend/auth/dev-header.ts`（新增）
- `src/pr-review/backend/publishers/index.ts`、`mock-publisher.ts`（新增）
- `src/pr-review/backend/dto/schemas.ts`（additive：allowedActions、uploads/schedule DTO）
- `src/pr-review/backend/index.ts`（barrel 更新）
- `src/pr-review/server/app.ts`、`server.ts`、`uploads.ts`、`seed.ts`（新增，composition root）
- `src/pr-review/config/env.ts`、`types.ts`、`index.ts`（additive：server/upload/auth/seed 配置）
- `package.json`（新增 `pr-review:server`、`pr-review:console` 等 scripts）

### 代码（Frontend，全部新增）

- `apps/pr-review-console/package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`
- `apps/pr-review-console/src/**`（api client、pages、components、styles）

### 测试

- `tests/pr-review/backend/orchestration.test.ts`
- `tests/pr-review/backend/authorization.test.ts`
- `tests/pr-review/backend/publisher.test.ts`
- `tests/pr-review/backend/server-api.test.ts`

## 接口变化

`03-contracts.md` 新增第 12.7 节（additive，不改动既有冻结字段）：

1. `ReviewDetailResponse` additive 增加 `allowedActions: ReviewActionType[]` 与 `finalDecision: FinalReviewDecision | null`（从最新 StoredReviewResult 映射；无结果时为 null）。
2. `POST /api/uploads` 请求/响应 DTO 与限制（文件数、大小、MIME 白名单）。
3. `POST /api/reviews/:id/schedule` 请求/响应 DTO（`expectedVersion`、`reason`、`PublishReceipt`）。
4. 开发身份 header 约定（`x-actor-id`/`x-actor-name`/`x-actor-role`），标注为 dev-only。
5. `PublishReceipt`：`{ receiptId, caseId, version, scheduledAt, mode: "mock", note }`。

新环境变量（见 `06-environment-and-api-config.md`）：`PR_REVIEW_SERVER_PORT`（默认 8080）、`PR_REVIEW_SERVER_HOST`（默认 127.0.0.1）、`PR_REVIEW_UPLOAD_DIR`（默认 data/uploads）、`PR_REVIEW_AUTH_MODE`（默认 dev-header）、`PR_REVIEW_DEMO_SEED`（默认 true）。

## 状态 / Schema 变化

- 无破坏性 schema 变化；以上均为 additive。
- Server 运行时新增进程内状态：idempotency-key -> action 结果缓存（重启失效，符合 MVP）；上传文件落盘目录（非业务事实源）。
- 业务事实仍只存 repository；engine MemorySaver 仅作执行状态。

## 错误处理

- 未带/伪造 actor header -> `401 VALIDATION_ERROR`（dev-header 模式下缺失身份）；越权动作 -> `403`（envelope code `VALIDATION_ERROR` 之外 additive 新 code `FORBIDDEN`、`UNAUTHORIZED`，随 12.7 一起冻结）。
- expectedVersion 不匹配 -> `409 VERSION_CONFLICT`。
- 当前 stage 不允许该动作 -> `422`（additive code `INVALID_STAGE_ACTION`）。
- 上传超限/坏 MIME/魔数不符 -> `413 PAYLOAD_TOO_LARGE` / `415 UNSUPPORTED_MEDIA_TYPE` / `400 VALIDATION_ERROR`。
- engine 抛错 -> fail closed：case 进入 `REVIEW_REQUIRED`，不返回 APPROVE；API 不伪装成功。

## 测试计划

- orchestration：创建->自动路由；approve 推进；revise 原子+v+1 重审；reject/escalate 终态；重复 Idempotency-Key 不重复动作；409 冲突；engine 失败 fail closed 进入 REVIEW_REQUIRED。
- authorization：角色×阶段矩阵正反例；提交者自我终审禁止；管理员无审批权；allowedActions 与服务端强制执行一致。
- publisher：默认 Mock；非 SCHEDULING stage 拒绝；幂等键只排期一次；receipt 可审计。
- server API：真实 HTTP 冒烟（ ephemeral 端口）：POST /api/reviews -> GET detail（含 allowedActions）-> approve -> revise -> history；uploads 正反例；error envelope 形状。
- Frontend：typecheck + production build 通过（组件级单测留待 TEST-003 E2E 补强）。

## 验收标准

- 一条命令启动 server 后，浏览器可完成 提交（含图片）-> 自动审核 -> 人工动作 -> 版本历史 -> Mock 排期 全流程。
- 所有既有 PR Review 测试不回退；新增 focused tests 通过；typecheck/Prettier/docs check 通过。
- 无真实 LLM/社媒/发布调用；demo 数据标注 synthetic；密钥不出现在任何响应/bundle。

## 非目标

- 生产数据库、durable checkpoint、outbox worker、真实 OIDC、真实 publisher、OCR/VLM 真实视觉能力、TEST-003 浏览器 E2E、Docker compose（INT-002）。
- 不修改既有 generate_post / upload_post 等 legacy 行为。
- 不预设任何 benchmark 指标数值。

## Design changes

- 2026-09-15：发现 `src/pr-review/config/env.ts` 已存在 `PR_REVIEW_API_PORT`（默认 3001）。为避免同一语义两个变量，放弃新增 `PR_REVIEW_SERVER_PORT`，server 监听端口复用 `PR_REVIEW_API_PORT`；`06-environment-and-api-config.md` 5.2 与本文已同步。其余设计不变。
- 2026-09-15：细读 `LangGraphReviewEngine` 后确认：`engine.resume(...)` 完成的是 graph 内部执行（直接产出 final decision），与业务多级人工 pipeline（OPERATOR/VISUAL/COMPLIANCE/MEDIA_MANAGER）不是同一语义；MemorySaver 进程重启即失效。MVP 人工动作一律按 12.7.6 转移表在 Backend 确定性推进，不调用 resume；REVISE 重审走新的 `engine.review(...)`。durable checkpoint + resume 恢复留给后续 BE-003 完整版。合同 12.7.6 已改为显式决策->stage 映射表。
- 2026-09-15：orchestration 需要 stage 推进持久化，但 `ReviewCaseRepository` 只有 create/get/list。additive 新增 `updateCase`（仅 stage/updatedAt；合同 12.2 已同步）。不修改既有 revision transaction 语义。
- 2026-09-15：HTTP 冒烟发现两处行为需冻结：(1) BE-001 action DTO 含必填 `actor` 字段（fixture 时代产物），SPRINT-005 服务端解析后忽略 body.actor、一律以 header actor 为准（合同 12.7.1 已明确）；(2) handler 直接 `schema.parse` 时 ZodError 落入 500，现统一在 HTTP 层把 ZodError 映射为 `400 VALIDATION_ERROR`（合同 12.7.1 已明确）。

## Implementation Result

已完成 Full-Stack Console MVP：

**Backend / Server**

- `services/orchestration.ts`：create -> engine -> 持久化 result+snapshot -> 12.7.6 stage 路由 -> SUBMIT/AUTO_ROUTE 审计；approve/revise/reject/escalate/schedule 全动作；幂等键进程内去重；409 VERSION_CONFLICT；engine 异常 fail closed -> REVIEW_REQUIRED；revise 走 BE-002 原子事务并对新版本重审；history 聚合五类记录。
- `auth/dev-header.ts` + `services/authorization.ts`：header 身份解析（401）、12.7.1 角色×阶段矩阵、提交者自我终审禁止、管理员无审批权、allowedActions 与服务端强制一致（403/422）。
- `publishers/`：Publisher port + MockPublisher（幂等 receipt，零真实发布）。
- `server/`（composition root）：Express app（requestId、统一 error envelope、ZodError->400）、`POST /api/uploads`（1..5 文件、单文件 5MB、PNG/JPG/GIF/WebP 魔数嗅探、随机文件名落盘、repo 内目录约束）、`/uploads/*` 只读托管、console dist 静态托管 + SPA fallback、synthetic demo seed。
- config additive：`PR_REVIEW_SERVER_HOST`/`PR_REVIEW_UPLOAD_DIR`/`PR_REVIEW_AUTH_MODE`/`PR_REVIEW_DEMO_SEED`（端口复用 `PR_REVIEW_API_PORT`）；repository additive：`updateCase`（仅 stage/updatedAt）。
- DTO additive：allowedActions、uploads/schedule DTO、UNAUTHORIZED/FORBIDDEN/INVALID_STAGE_ACTION；body.actor 忽略、身份以 header 为准。

**Frontend（apps/pr-review-console）**

- Vite + React + TS 独立 package：Dashboard（真实统计）、Submission（文案+平台+拖拽上传+来源链接）、Queue（stage/risk/关键字筛选+cursor 分页）、Review Detail（span 高亮、五维评分、issues、证据快照、Judge 建议、版本 diff、审计时间线、动作 modal/409 提示、排期回执）、Evaluation（latestRun=null 显式「未计算」+指标口径）。
- 角色切换器（localStorage）；全部请求经类型化 API client + actor header + 幂等键；零 Algorithm import、零 key、零风险重算。

## Validation Evidence

- Focused backend tests：4 suites / 25 tests PASS（orchestration、authorization、publisher、server-api 真实 HTTP 冒烟）。
- 全部 PR Review tests（源 `.ts`）：25 suites / 192 tests PASS（`--testPathPatterns='tests/pr-review/.*\.test\.ts$'` 忽略 `.int.test.ts`；jest 不应匹配 `dist/` 陈旧构建产物）。
- TypeScript：`node node_modules/typescript/bin/tsc --noEmit` PASS（根工程）；console `tsc --noEmit` PASS。
- Prettier：`src/pr-review/**/*.ts`、`tests/pr-review/**/*.ts`、`apps/pr-review-console/**`、`docs/pr-review/**/*.md` 全部 PASS（仓库 legacy 区 227 个未格式化文件为既有状态，不在本任务范围）。
- Docs Gate（自动）：`node --import tsx scripts/pr-review-docs-gate.ts --task SPRINT-005` PASS。
- Console build：`vite build` 成功（dist 207KB JS / 16KB CSS）。
- E2E 冒烟（真实 server，curl）：seed 5 Case（2 SCHEDULING / 1 REVIEW_REQUIRED / 2 REJECTED）；REQUESTER 越权 403；approve 链 REVIEW_REQUIRED→OPERATOR_REVIEW→COMPLIANCE_REVIEW→MEDIA_MANAGER_APPROVAL→SCHEDULING；提交者自我终审 403；schedule->COMPLETED+幂等重放同 receipt；终态动作 422；错误版本 409；上传正例 201/反例 415；无 header 401；非法 body 400；SPA `/` 与深链 200；`/uploads/<file>` 200。
- 真实 LLM/社媒/发布调用：0；浏览器 bundle 不含任何 key。
