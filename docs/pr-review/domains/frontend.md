# Frontend Domain

## 1. 边界

Frontend 是审核控制台，只通过 Backend API client 读取和提交冻结 DTO。它不调用 LLM、不导入 server config/Secret、不访问社交平台、不自行计算 risk/confidence/permission。

## 2. 当前行为

截至 DATA-001，`apps/pr-review-console/` 只有 Phase 0 目录说明和局部规则；React/Vite 应用尚未实现。

## 3. Docs-first Gate

修改 `apps/pr-review-console/**` 前必须先创建/更新任务 Change Log 并修改本文。若页面需要新字段或 endpoint，Frontend 不能自行创造；必须先通过跨 Domain 设计更新 Backend Domain 与 `03-contracts.md`，再输出 `DOCS GATE: PASS`。

## 4. 稳定 UI 数据原则

- 风险、证据、可执行动作和版本均以 Backend 响应为准。
- 未知/缺失值显式展示，不用前端默认值掩盖服务失败。
- 人工动作提交 reason 与 expectedVersion。
- 浏览器 bundle、network payload、错误上报和 telemetry 永不包含 API Key。
- Social Context 若未来展示，只能使用 Backend 已定义的脱敏摘要/evidence DTO，不直接展示或请求平台原始接口。

## 5. Frontend MVP 状态

FE-001..FE-004 由 SPRINT-005 交付 MVP。

### 5.1 工程形态（FE-001）

- `apps/pr-review-console/`：Vite + React + TypeScript，独立 package（不改动根 package 依赖）；`vite dev` 通过 proxy 把 `/api`、`/uploads` 转发到 `PR_REVIEW_API_PORT`（默认 3001）；`vite build` 产物由 server 静态托管，实现单端口交付。
- 类型化 API client：只使用 `03-contracts.md` 冻结的 DTO；统一 error envelope 处理；所有 mutation 携带 `Idempotency-Key`、`expectedVersion` 与 actor header（`x-actor-id`/`x-actor-name`/`x-actor-role`）。
- actor 由页面顶部「角色切换器」选择并持久化在 localStorage；UI 显式标注 dev-header 是开发模式身份。

### 5.2 页面（FE-002 / FE-003 / FE-004）

- Dashboard `/`：真实统计卡片（Case 总数、待人工、按 stage/风险分布）与最近 Case；数据全部来自 `GET /api/reviews` 与 detail；不展示伪造指标。
- Submission `/submit`：内容类型、目标平台多选、文案（字数统计）、图片上传（点击/拖拽、预览、删除，先经 `POST /api/uploads` 取得 `/uploads/...` URL）、来源链接；客户端只做形状校验，提交后跳转 Detail。
- Review Queue `/queue`：按 stage、风险、关键字筛选，cursor 分页；空态/错误态显式展示。
- Review Detail `/reviews/:id`：当前/原始内容对照、issue textSpan 在正文上高亮、图片素材展示、五维 risk score 与 verdict、issues（category/severity/reason/suggestion）、evidence 面板、Judge/Guard 结论与 revision direction；动作按钮只渲染 Backend 返回的 `allowedActions`，reason 必填 modal，409 后自动刷新而不是静默覆盖；版本历史 tab 提供两版 diff 对比；审计时间线 tab 展示 append-only actions。
- Evaluation `/evaluation`：`GET /api/evaluations/latest`；`latestRun=null` 时展示「未计算」与指标口径说明；不写死任何数值。

### 5.3 展示边界

- 五维业务维度展示为 PUBLIC_RELATIONS / OPERATIONS / PRODUCT / CUSTOMER / COMPLIANCE_SAFETY；Visual 只作为素材/证据分析出现，不作为第六个一级维度。
- 不 import Algorithm、不直接调用 LLM/Social/OCR/VLM、不持有任何 key、不重算 risk/confidence/allowedActions/publishable。

## 6. PRODUCT-001 后续展示边界

Frontend 后续通过 Backend API 展示五个业务维度的 risk score、confidence、verdict、issues、evidence coverage、Critic 冲突、Judge reasoning、Policy Guard 最终决策和 revision direction。Visual 显示为证据/素材分析能力，不显示为第六个一级风险维度。

UI 不自行重算权重、hard gate、allowed actions 或 publishable，也不直接调用模型、Social/OCR/VLM provider。PRODUCT-001/ALG-002/ALG-003 不修改 Frontend 代码。
