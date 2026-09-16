# Backend Domain

## 1. 边界

Backend 负责 PR Review 的业务入口、DTO/API、Case 生命周期、版本、人工动作、审计、持久化边界、权限与后续 ReviewEngine orchestration。它不写 Prompt、不实现风险判断、不直接访问 provider SDK，也不导入 Algorithm graph nodes、reviewers、prompts 或 policy internals。

稳定依赖方向：

```text
Frontend / CLI / future WorkBuddy
      |
      v
Backend API -> Backend Services -> Repository ports
                         |
                         v
                   ReviewEngine port
```

Backend 可以调用 `ReviewEngine.review(...)` / `ReviewEngine.resume(...)`，但风险分数、五维判断、hard gate、revision 建议都必须由 Algorithm 产出。

## 2. 当前行为

截至 SPRINT-004 开始：

- `src/pr-review/backend/` 只有边界骨架和工程规则。
- 尚无 PR Review API DTO、controller skeleton、error envelope、repository port 或 InMemory adapter。
- `05-project-board.md` 曾将 ALG-004 标记 READY，但 `04-development-plan.md` 明确 ALG-004 依赖 BE-002 repository/evidence snapshot port，因此在 BE-002 DONE 前 ALG-004 必须 BLOCKED。

## 3. Docs-first Gate

修改 `src/pr-review/backend/**` 前必须先：

1. 创建/更新对应 `docs/pr-review/change-log/<TASK-ID>.md`。
2. 更新本文。
3. API、DTO、错误码、分页、repository record/port 或并发语义变化时更新 `03-contracts.md`。
4. 更新 `05-project-board.md`。
5. 运行对应 docs check 并输出 `DOCS GATE: PASS`。

实现中发现合同不足时，必须停止代码，追加 Design Changes，更新 Domain/Contracts 后重新 Docs Gate。

## 4. BE-001 — API Foundation 设计

BE-001 冻结并实现以下 MVP endpoints：

- `POST /api/reviews`
- `GET /api/reviews/:id`
- `GET /api/reviews`
- `POST /api/reviews/:id/approve`
- `POST /api/reviews/:id/revise`
- `POST /api/reviews/:id/reject`
- `POST /api/reviews/:id/escalate`
- `GET /api/reviews/:id/history`
- `GET /api/evaluations/latest`

### 4.1 BE-001 负责

- DTO。
- Zod validation。
- route/controller handler skeleton。
- typed error envelope。
- pagination contract。
- request size validation。
- `Content-Type: application/json` validation。
- 将人工动作输入映射为 service/repository 输入。

### 4.2 BE-001 不负责

- Auth。
- Publisher。
- 真实数据库。
- 风险判断。
- Prompt。
- 直接调用 DeepSeek/Qwen。
- import graph/reviewer/prompt internals。

### 4.3 DTO 原则

- DTO fixed objects 使用 strict validation。
- submitter/actor 最终应来自认证上下文；BE-001 的无 Auth MVP 可接受显式 actor fixture，但必须标注为测试/开发上下文，不能作为安全模型。
- mutation 携带 `expectedVersion`。
- list 使用 `limit` + opaque `cursor`。
- error envelope 不输出 secret、stack trace 或完整敏感正文。

## 5. BE-002 — Repository / Version / Evidence / Audit 设计

BE-002 冻结并实现：

- `ReviewCaseRepository`
- `ContentVersionRepository`
- `ReviewResultRepository`
- `EvidenceRepository`
- `ReviewActionRepository`

第一版实现 InMemory adapter，但 interfaces 必须允许后续替换数据库。

### 5.1 ContentVersion immutable

正文修改不得覆盖旧内容。修改流程：

```text
version N
  -> validate expectedVersion
  -> create version N+1
```

旧版本只能读取，不能 update/delete。

### 5.2 ReviewAction append-only

`APPROVE`、`REVISE`、`REJECT`、`ESCALATE` 等动作只追加 audit record。普通业务代码不得删除或覆盖历史 action。

### 5.3 Optimistic locking

修改类操作必须携带 `expectedVersion`。当前版本不等于 `expectedVersion` 时返回 `VERSION_CONFLICT`，不得静默覆盖。

### 5.4 Result / Evidence version isolation

每次审核结果必须绑定：

- `caseId`
- `version`
- `executionId`

旧 version 的 result/evidence 不得挂到新 version 上。

### 5.5 EvidenceSnapshot

`EvidenceSnapshot` 用于固定审核当时使用的知识与社媒证据，至少包含：

- `snapshotId`
- `caseId`
- `version`
- `executionId`
- `knowledgeVersion`
- `socialContextVersion`
- `evidenceItems`
- `createdAt`

以后知识库变化时，历史审核仍应能解释当时使用的 evidence。

### 5.6 Revision transaction

REVISE 必须是 transaction-like 操作：

```text
validate expectedVersion
  -> create immutable new ContentVersion
  -> append ReviewAction
  -> commit
```

失败时不能留下半个新版本或半条 action。

## 6. 错误模型

Backend typed errors：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `VERSION_CONFLICT`
- `UNSUPPORTED_MEDIA_TYPE`
- `PAYLOAD_TOO_LARGE`
- `METHOD_NOT_ALLOWED`
- `DEPENDENCY_UNAVAILABLE`
- `INTERNAL_ERROR`

Repository typed errors：

- `NOT_FOUND`
- `VERSION_CONFLICT`
- `DUPLICATE_RECORD`
- `TRANSACTION_FAILED`
- `INVALID_STATE`

错误详情只包含可公开的诊断字段，不输出 provider key、完整正文、完整 evidence 或 stack trace。

## 7. 测试策略

BE-001 focused tests：

- DTO 正反例。
- unknown field fail。
- content-type fail。
- payload size fail。
- pagination validation。
- error envelope validation。
- API handler 不 import graph/reviewer/prompt internals。

BE-002 focused tests：

- 创建 Case 与 initial ContentVersion。
- ContentVersion immutable。
- ReviewAction append-only。
- optimistic locking conflict。
- result/evidence 绑定 `caseId + version + executionId`。
- EvidenceSnapshot 字段完整。
- revise transaction 成功与失败回滚。
- InMemory adapter 返回副本，外部 mutation 不污染内部状态。

## 8. SPRINT-004 状态

BE-001 与 BE-002 在 SPRINT-004 Foundation 阶段执行。BE-002 DONE 后，ALG-004 的 repository/evidence snapshot 依赖才算解除。BE-003 orchestration、Auth、Publisher 与真实数据库仍为后续任务。

## 9. SPRINT-005 — Orchestration / Auth / Publisher / Server 设计

### 9.1 BE-003 ReviewOrchestrationService

`src/pr-review/backend/services/orchestration.ts` 是唯一编排入口：

- `createReview(input, actor)`：创建 Case v1 + SUBMIT action -> 调用 `ReviewEngine.review(...)` -> 持久化 `StoredReviewResult` 与 `EvidenceSnapshot` -> 按 12.7.6 stage 转移表落 stage -> 追加 AUTO_ROUTE action。engine 抛异常时 fail closed：stage=`REVIEW_REQUIRED`，不返回成功审批。
- `getReview(caseId, actor)`：返回 case、最新 `StoredReviewResult.output`、按 AuthorizationPolicy 计算的 `allowedActions`。
- `listReviews(query)`：stage/riskLevel 过滤（riskLevel 来自最新 result 的 aggregateResult，缺失时不参与过滤）+ cursor 分页。
- `approve/reject/escalate(caseId, body, actor, idempotencyKey)`：校验身份、stage 权限、expectedVersion；优先 `engine.resume(...)`；execution 不在进程内时按 12.7.6 表确定性推进；append-only 写 ReviewAction；相同 Idempotency-Key 直接返回首次结果。
- `revise(caseId, body, actor, idempotencyKey)`：`RevisionTransactionRepository.revise(...)` 原子创建 v+1 与 action，随后对新 version 重新运行 engine 并持久化结果。
- `getHistory(caseId)`：聚合 case、versions、actions、results、evidenceSnapshots。
- `getLatestEvaluation()`：返回真实 benchmark run；无记录返回 `latestRun: null`。

Backend 不计算风险分、不写 prompt、不 import graph/reviewer/prompt internals；只执行 Algorithm 输出与 policy 明示的路由。

### 9.2 BE-004 Auth 与 AuthorizationPolicy

- `src/pr-review/backend/auth/dev-header.ts`：从 `x-actor-id` / `x-actor-name` / `x-actor-role` 解析 actor；缺失或非法 role 返回 `401 UNAUTHORIZED`。
- `src/pr-review/backend/services/authorization.ts`：12.7.1 角色×阶段矩阵的唯一实现；同时负责 `allowedActions(case, actor)` 与 `assertActionAllowed(...)`（服务端强制）；提交者本人不得在 MEDIA_MANAGER_APPROVAL 关 APPROVE；管理员无审批动作；越权写审计并抛 `FORBIDDEN`。
- 生产 OIDC/SSO 适配器不在本轮；dev-header 身份在所有文档与 UI 中标注为开发模式。

### 9.3 BE-005 Publisher 与 MockPublisher

- `src/pr-review/backend/publishers/`：`Publisher` port、`MockPublisher`（返回 `PublishReceipt`，`mode: "mock"`）、schedule service 守卫（MEDIA_MANAGER + SCHEDULING + expectedVersion + idempotency）。
- 不连接任何真实社交账号；`REAL_PUBLISHING_ENABLED` 保持 false；Algorithm 永远不可调用 publisher。

### 9.4 Composition Root / HTTP Server（INT-001 MVP）

`src/pr-review/server/` 是 composition root，不属于 Backend 业务层：

- `app.ts`：Express app factory，接线 repositories/engine/publisher/services；统一 requestId、错误 envelope 中间件、JSON body 32MB 上限（上传需要）、`/uploads/*` 只读静态托管、console dist 静态托管与 SPA fallback。
- `uploads.ts`：`POST /api/uploads`：base64 JSON、1..5 个文件、单文件 ≤5MB、MIME 白名单 + 魔数嗅探、随机文件名落盘 `PR_REVIEW_UPLOAD_DIR`。
- `seed.ts`：`PR_REVIEW_DEMO_SEED=true`（默认）且 repository 为空时注入明确标注 synthetic 的演示 Case，让首次启动即可浏览完整流程。
- `server.ts`：入口，读取 typed config，listen `PR_REVIEW_SERVER_HOST:PR_REVIEW_SERVER_PORT`（默认 127.0.0.1:8080）。

### 9.5 SPRINT-005 错误语义

沿用第 6 节错误模型，additive：`UNAUTHORIZED`(401)、`FORBIDDEN`(403)、`INVALID_STAGE_ACTION`(422)；错误详情不含 secret、stack trace 或完整正文。
