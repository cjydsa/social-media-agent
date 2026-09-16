# 开发计划

## 1. 依赖与推荐顺序

```text
INFRA-001 -> INFRA-002
  -> DOCS-GATE-001
  -> DATA-001
  -> ALG-001 + TEST-001
  -> PRODUCT-001
  -> ALG-002 + ALG-003 + TEST-002
  -> SPRINT-004 Foundation: BE-001 + BE-002 + DATA-002 + TEST-004 Phase A
  -> ALG-004 RAG / LLM Reviewer
  -> Backend Orchestration MVP
  -> Frontend
  -> Evaluation
  -> Integration
```

Test Track 从第一天开始并伴随所有 milestone；Evaluation 可在算法 MVP 后跑 baseline，但 benchmark 治理应更早开始。任务完成时必须更新 `05-project-board.md`。每个任务还必须遵循 `07-vibe-coding-workflow.md`：Change Log/Domain/Contracts 文档先行，通过 Docs Gate 后才能实现。

## 2. Infrastructure Track

### INFRA-001 — Centralized Configuration & Secret Management

- **Goal**：建立 PR Review 类型安全配置、Secret redaction、Provider contract、安全 publisher flags 与 config doctor。
- **Input**：仓库环境变量审计、PRD NFR、Publisher/Frontend 安全边界。
- **Output**：Zod config、`.env.pr-review.example`、mock provider factory、doctor、泄漏防护测试和变量矩阵。
- **Files**：`src/pr-review/config/**`、`src/pr-review/algorithm/providers/**`、`.env.pr-review.example`、config tests/docs/script。
- **Dependencies**：M0；必须在 ALG-001 前完成。
- **Acceptance Criteria**：mock/local 无 Key 启动；按 LLM provider 只要求匹配 Key；Secret 不进入日志/JSON/Frontend；development 实际发布永远关闭；legacy clients 不被重构。
- **Tests**：provider 条件校验、LangSmith 可选性、publisher guard、safe config/doctor redaction、frontend boundary、无 `.env` mock mode、credential pattern scan。
- **Definition of Done**：Prettier/typecheck/相关 Jest/doctor 通过，配置文档和 board 更新，不调用真实 API。

### INFRA-002 — DeepSeek & Qwen Provider Support

- **Goal**：在集中式配置和单一 factory 下支持 DeepSeek 与 Qwen LangChain chat models。
- **Input**：INFRA-001、DeepSeek/LangChain 官方集成、Model Studio OpenAI-compatible endpoint。
- **Output**：条件 Secret 配置、DeepSeek/Qwen adapters、依赖注入测试、安全 smoke scripts 和文档。
- **Files**：`src/pr-review/config/**`、`src/pr-review/algorithm/providers/**`、scripts/tests/docs/example/package manifests。
- **Dependencies**：INFRA-001；必须在 ALG-001 前完成。
- **Acceptance Criteria**：只验证所选 provider；Qwen Base URL 无 region 硬编码；reviewer 不接触 Key/SDK；LangChain structured output/tools/usage/tracing 能力保留；无真实单测调用。
- **Tests**：mock keyless、DeepSeek/Qwen 缺失配置、Secret/Doctor/Frontend redaction、SDK factory dependency injection。
- **Definition of Done**：Prettier/typecheck/Jest/doctor 通过；smoke 默认不调用；legacy graph/publisher 不变。

### DOCS-GATE-001 — Docs-first Governance

- **Goal**：建立七步 Docs-first 流程、Domain 文档、不可回写的任务 Change Log 和轻量自动 co-change Gate。
- **Input**：Phase 0/INFRA 历史 diff、现有 docs/AGENTS、用户规定的 Docs-first 规则。
- **Output**：`07-vibe-coding-workflow.md`、Domain docs、历史/当前 Change Logs、更新后的 AGENTS、docs gate script/tests/command。
- **Files**：`docs/pr-review/**`、所有 PR Review `AGENTS.md`、`scripts/pr-review-docs-gate.ts`、`tests/pr-review/docs-gate/**`、`package.json`。
- **Dependencies**：INFRA-002；必须在 DATA-001 与所有业务任务前完成。
- **Acceptance Criteria**：源码前置文档要求明确；历史补档可识别；缺 Change Log/Domain/Contracts 时自动 Gate fail；不宣称检查 Git 时间顺序。
- **Tests**：纯函数路径映射、缺文档/完整文档、跨域、docs-only 与 CLI working-tree smoke。
- **Definition of Done**：文档先完成并人工输出 PASS；script/tests 后实现；Prettier/typecheck/Jest/diff check 通过；不改业务代码。

### DATA-001 — Social Data Interface & Contract Design

- **Goal**：为 Reputation Review 冻结合规的平台 Adapter、标准化 Schema、Social Context port 和 fixture/contract-test 策略。
- **Input**：PRD Reputation 维度、中国大陆目标平台、隐私与平台访问约束。
- **Output**：Social Data Domain 文档；SocialPost/SocialComment/Snapshot/Adapter/Provider 合同；fixture 与合同测试设计。
- **Files**：仅 `docs/pr-review/**` 与相关 `AGENTS.md`。
- **Dependencies**：DOCS-GATE-001 文档规则；必须在 ALG-001 前完成。
- **Acceptance Criteria**：五个平台状态明确；accessMode 合法；Algorithm 只依赖 Snapshot Provider；证据不等于事实裁决；不实现真实 Connector。
- **Tests**：DATA-001 不写运行时代码；预定义后续 Adapter 合同套件和 fixture provenance 检查。
- **Definition of Done**：PRD/Architecture/Contracts/Domain/Plan/Board 一致，无真实数据/API/爬虫或伪造 fixture。

### DATA-002 — Social Context MVP（SPRINT-004 Foundation）

- **Goal**：基于 DATA-001 合同实现 local fixture/authorized export ingestion、normalization、deduplication、SocialContextBuilder 与 SocialContextProvider MVP。
- **Input**：DATA-001 contracts、合法 fixture/授权导出、平台映射规则、DATA-002 Change Log。
- **Output**：SocialDataAdapter runtime port、LocalFixtureSocialAdapter、AuthorizedExportSocialAdapter、统一 SocialContextSnapshot。
- **Files**：`src/pr-review/social-data/**`、必要 schema/port 兼容扩展、`evals/pr-review/fixtures/social/**`、contract tests。
- **Dependencies**：DATA-001、ALG-001 social schemas、TEST-004 provenance policy；不依赖 ALG-004。
- **Acceptance Criteria**：不绕过平台控制；Algorithm 只通过 SocialContextProvider 消费；provider unavailable 与成功空结果可区分。
- **Tests**：统一 Adapter contract suite、空结果、不可用、malformed、去重、时间归一、隐私脱敏；不调用真实平台 API。
- **Definition of Done**：单元/合同测试通过、provenance/隐私审查完成；真实 Connector 需独立授权任务。

## 3. Algorithm Track

### PRODUCT-001 — 五维多智能体产品核心重对齐

- **Goal**：把产品升级为五个业务维度、Multimodal Evidence Layer 与 Planner/Specialist/Critic/Judge/Guard/Revision 架构。
- **Output**：PRD v1.1、架构/合同/Domain/WorkBuddy 边界与迁移说明。
- **Dependencies**：ALG-001、TEST-001。
- **Definition of Done**：四个后续任务 Docs Gate 在代码前通过，产品、合同与计划无漂移。

### ALG-001 — 冻结领域 Schema 与 ReviewEngine port

- **Goal**：将 v1 contracts 实现为唯一可导出的 Zod schema/type 和稳定入口。
- **Input**：`01-PRD.md`、`03-contracts.md`。
- **Output**：schema、ReviewEngine interfaces、typed failure、public barrel。
- **Files**：`src/pr-review/algorithm/schemas/**`、`src/pr-review/algorithm/index.ts`。
- **Dependencies**：M0；无代码依赖。
- **Acceptance Criteria**：字段/枚举/约束与合同一致；无 Backend/HTTP import；非法 confidence/span/modelUsage 被拒绝。
- **Tests**：schema 正反例、JSON round-trip、公开 import 编译测试。
- **Definition of Done**：build/lint/test 通过，contracts 无漂移，TEST-001 通过并评审签字。

### ALG-002 — Deterministic Multi-Agent LangGraph MVP

- **Goal**：运行 Planner、Evidence Planning、五个并行 Specialist、Critic、Judge、Guard、Revision 与 HITL graph。
- **Input**：ALG-001 schema、ReviewEngineInput、版本 snapshot。
- **Output**：graph/state、五维 deterministic agents、MemorySaver、interrupt/resume/revision loop。
- **Files**：`algorithm/graph/**`、`state/**`、`agents/**`、`engine/**`、`evidence/**`。
- **Dependencies**：ALG-001、TEST-001。
- **Acceptance Criteria**：五维至少 LIGHT 并行运行；Critic/Judge/Guard 职责分离；同一 fixture 可复现；失败不 PASS。
- **Tests**：十类 scenario、graph 路径、interrupt/resume/revision、mock failure、state isolation。
- **Definition of Done**：M1 demo 可本地运行，graph tests 全绿，无真实 LLM/Publisher 调用。

### ALG-003 — 五维评分、Decision Judge 与 Policy Guard

- **Goal**：实现 v1.1 contract extension、可配置 0–100 五维评分、AI-style Judge 和 deterministic hard gates。
- **Input**：五个 DimensionReviewResult、Critic、Judge recommendation、typed policy、reviewer failures。
- **Output**：ReviewPlan/Dimension/Critic/Judge/Final schemas、FinalReviewDecision 与 revision proposal。
- **Files**：`algorithm/schemas/multi-agent.ts`、`policy/**` 与 public contract additive updates。
- **Dependencies**：PRODUCT-001、ALG-001；与 ALG-002 在本 Sprint 协同实现。
- **Acceptance Criteria**：加权分不稀释 hard blocker；缺证据/低 confidence/冲突/失败人工；Judge 不得绕过 Guard。
- **Tests**：schema/决策表、边界分数、hard gate、Judge override、failure injection。
- **Definition of Done**：路由表与 PRD 一致，所有分支可观测且 100% 分支用例覆盖关键安全规则。

### ALG-004 — Evidence RAG 与真实五维结构化 LLM Reviewers

- **Goal**：接入版本化品牌知识检索、证据快照和真实 structured reviewers。
- **Input**：知识文档、query、规则/模型配置、ALG-003、BE-002 EvidenceSnapshot port、TEST-004 Benchmark v1 manifest。
- **Output**：版本化 evidence retrieval 与五维 Specialist/Planner/Critic/Judge 的真实 structured implementation。
- **Files**：`retrieval/**`、`prompts/**`、`reviewers/**`、`schemas/**`（仅兼容扩展）。
- **Dependencies**：ALG-003 DONE、BE-002 repository/evidence snapshot port DONE、TEST-004 Public Content Review Benchmark v1 Phase A DONE。DATA-002 不是所有 case 的硬依赖，但 PUBLIC_RELATIONS/CUSTOMER 使用 Social Context 时必须 graceful unavailable。
- **Acceptance Criteria**：输出全部 schema validate；证据可回放；prompt/model/knowledge version 可追踪；解析/检索失败人工。
- **Tests**：retrieval contract、prompt snapshot、parse failure、grounding citations、provider mock。
- **Definition of Done**：M4 benchmark 可重复运行，无硬编码质量结果，安全评审完成。

### ALG-005 — OCR/VLM Multimodal Evidence Layer

- **Goal**：从图像/OCR/VLM 产生可审计 EvidenceItem，并路由给相关业务维度；素材失败时闭锁。
- **Input**：图片 URL/安全下载结果、当前文案、品牌视觉知识。
- **Output**：OCR/VLM evidence、多维 finding 映射、素材失败类型；不创建 Visual 一级维度。
- **Files**：`visual/**`、`prompts/visual/**`、`reviewers/visual*`。
- **Dependencies**：ALG-003、ALG-004 retrieval port。
- **Acceptance Criteria**：检查图片文字、Logo、品牌元素、图文一致性和敏感元素；无图跳过；不可访问图进入人工。
- **Tests**：固定图片 fixtures、OCR/VLM mocks、超时/大文件/坏 MIME、安全 URL。
- **Definition of Done**：M5 视觉路径可回放，schema/trace 完整，数据许可确认。

## 4. Backend Track

### BE-001 — API DTO、错误模型与路由骨架

- **Goal**：实现 v1 endpoint/DTO 骨架和一致错误响应，不含业务捷径。
- **Input**：`03-contracts.md`、ALG-001 public types。
- **Output**：routes/controllers、DTO validation、error mapper、OpenAPI 草案。
- **Files**：`backend/api/**`、`dto/**`。
- **Dependencies**：ALG-001、TEST-001。
- **Acceptance Criteria**：9 个 endpoint 均有 schema；submitter 不从 body 接受；未知字段/非法枚举失败。
- **Tests**：API contract、status/error envelope、content-type/size limit。
- **Definition of Done**：OpenAPI 与 contracts 对齐，测试通过，未 import prompts/nodes。

### BE-002 — Repository 与 Case/Version/Audit 生命周期

- **Goal**：实现 Case、不可变版本、ReviewResult/Evidence、append-only action ports 和首个 adapter。
- **Input**：ReviewCase/Action contracts、事务要求。
- **Output**：repository interfaces、in-memory adapter（MVP）、事务 service。
- **Files**：`backend/repositories/**`、`services/case*`、`audit/**`。
- **Dependencies**：ALG-001。
- **Acceptance Criteria**：revision 原子增版；历史不可更新；乐观锁冲突；Case 与结果按 version 隔离。
- **Tests**：repository contract suite、并发 revise、rollback、audit immutability。
- **Definition of Done**：所有 adapter 运行同一 contract suite，M2 数据生命周期可演示。

### BE-003 — ReviewEngine orchestration 与恢复

- **Goal**：仅通过 ReviewEngine port 启动/恢复 graph，可靠持久化人工节点。
- **Input**：ALG-002/003、BE-002、人工动作。
- **Output**：orchestration service、execution refs、outbox/idempotency flow。
- **Files**：`backend/services/review*`、`repositories/outbox*`。
- **Dependencies**：ALG-003、BE-002。
- **Acceptance Criteria**：重复 action 不重复 resume；DB/graph 部分失败可恢复；typed failure 进入 REVIEW_REQUIRED。
- **Tests**：integration、crash boundary、duplicate delivery、stale version。
- **Definition of Done**：完整人工 Case 生命周期通过，失败注入无 false approve。

### BE-004 — Auth 与多角色授权

- **Goal**：实现身份抽象、角色/阶段动作 policy 和队列过滤。
- **Input**：PRD 角色矩阵、Case stage、actor。
- **Output**：auth middleware/port、policy service、allowedActions。
- **Files**：`backend/auth/**`、`services/authorization*`、`api/middleware/**`。
- **Dependencies**：BE-001、BE-002。
- **Acceptance Criteria**：最小权限；禁止自我最终审批；管理员不自动拥有审批权；拒绝动作也审计。
- **Tests**：角色×阶段权限矩阵、水平越权、未认证/伪造 submitter。
- **Definition of Done**：安全测试通过，policy 文档与 UI allowedActions 一致。

### BE-005 — Publisher port 与 MockPublisher

- **Goal**：建立安全发布边界，开发默认只模拟排期。
- **Input**：最终批准 Case、publisher config、幂等键。
- **Output**：Publisher interface、MockPublisher receipt、production guard（不接真实账号）。
- **Files**：`backend/publishers/**`、`services/scheduling*`。
- **Dependencies**：BE-003、BE-004。
- **Acceptance Criteria**：默认 Mock；HIGH/非最终批准/无授权拒绝；相同键只排期一次。
- **Tests**：guard、idempotency、environment config、receipt audit。
- **Definition of Done**：M2 不需任何社交凭据，测试确认不会调用现有 upload_post。

## 5. Frontend Track

### FE-001 — React/Vite 控制台骨架与 API client

- **Goal**：建立路由、布局、类型化 Backend client 和错误/认证边界。
- **Input**：OpenAPI/contracts、设计 tokens。
- **Output**：可启动 console、页面 routes、API client、mock server。
- **Files**：`apps/pr-review-console/**`。
- **Dependencies**：BE-001。
- **Acceptance Criteria**：不 import Algorithm/LLM；所有数据经 API；loading/empty/error 可见。
- **Tests**：typecheck、route smoke、API client contract、无模型 key bundle check。
- **Definition of Done**：本地 mock 可浏览 8 个页面入口，lint/test/build 通过。

### FE-002 — Submission、Dashboard 与 Review Queue

- **Goal**：支持提交 Case、查看概况、筛选人工队列。
- **Input**：POST/GET list contracts、allowedActions。
- **Output**：表单、Dashboard cards、queue filters/pagination。
- **Files**：`pages/submission/**`、`pages/dashboard/**`、`pages/queue/**`。
- **Dependencies**：FE-001、BE-001/002。
- **Acceptance Criteria**：字段校验、图片/平台输入、空态/错误、cursor 分页；不展示伪造指标。
- **Tests**：component/user flow、a11y、API error/empty/pagination。
- **Definition of Done**：能提交并从队列打开真实 Backend Case。

### FE-003 — Review Detail、Evidence、Diff 与人工动作

- **Goal**：完整呈现风险证据/历史并安全执行四类动作。
- **Input**：detail/history/action contracts。
- **Output**：详情、span 高亮、Evidence panel、version diff、timeline、动作 modal。
- **Files**：`pages/review-detail/**`、`components/evidence/**`、`components/diff/**`。
- **Dependencies**：FE-001、BE-003/004。
- **Acceptance Criteria**：展示合同要求全部字段；reason 必填；expectedVersion；409 后不覆盖；仅渲染 allowedActions。
- **Tests**：span Unicode、action flows、conflict refresh、权限、keyboard/a11y。
- **Definition of Done**：M3 端到端提交/查看/审核/修改可演示。

### FE-004 — Evaluation Dashboard

- **Goal**：展示真实 evaluation run、数据集版本、样本数和 PRD 指标。
- **Input**：`GET /api/evaluations/latest`。
- **Output**：指标、运行元数据、无数据/失败态、实验比较入口。
- **Files**：`pages/evaluation/**`。
- **Dependencies**：FE-001、TEST-004、BE evaluation endpoint。
- **Acceptance Criteria**：null 显示“未计算”；不写死数值；标注 dataset/algorithm version/sample count。
- **Tests**：null/partial/complete/failed responses、格式化和 a11y。
- **Definition of Done**：M6 结果可追溯，UI 无预置简历指标。

## 6. Test / Evaluation Track

### TEST-001 — Contract 与 schema 测试基线

- **Goal**：从 Day 1 防止跨域合同漂移。
- **Input**：`03-contracts.md`、ALG-001、BE-001 DTO。
- **Output**：共享 JSON fixtures、schema/API compatibility tests。
- **Files**：`tests/pr-review/contracts/**`、`fixtures/**`。
- **Dependencies**：与 ALG-001/BE-001 协作，不等待功能完成。
- **Acceptance Criteria**：核心对象和 9 endpoints 均有正反例；null/enum/span/version 边界覆盖。
- **Tests**：本任务自身即测试套件，并在 CI 独立执行。
- **Definition of Done**：任何破坏性字段变化会使 CI 失败并指向合同差异。

### TEST-002 — Algorithm unit/graph/regression suite

- **Goal**：验证五维 contracts、Planner/Specialists/Critic/Judge/Guard、LangGraph、HITL 与既有 PR Review 非回归。
- **Input**：ALG-002/003、安全决策表。
- **Output**：unit/graph/failure/regression tests。
- **Files**：`tests/pr-review/algorithm/**`、`regression/**`。
- **Dependencies**：ALG-002；可随节点增量提交。
- **Acceptance Criteria**：所有高风险/低 confidence/失败路径闭锁；既有 graph snapshot/测试不变。
- **Tests**：20 项预定义矩阵，含十类 deterministic fixture、hard gates、interrupt/resume/revision、无真实 API 和 existing suite。
- **Definition of Done**：关键安全分支全覆盖，无 flaky 外网依赖。

### TEST-003 — Backend/API/Frontend E2E

- **Goal**：验证 Case 生命周期、权限、并发和主要用户旅程。
- **Input**：BE-001..005、FE-002/003、MockPublisher。
- **Output**：integration/API/browser E2E suites。
- **Files**：`tests/pr-review/backend/**`、`integration/**`、console e2e 目录。
- **Dependencies**：BE-005、FE-003。
- **Acceptance Criteria**：提交→审核→修订→再审→模拟排期；reject/escalate；越权/冲突/重试。
- **Tests**：上述场景、重启恢复、重复请求、publisher guard。
- **Definition of Done**：M3/M7 主路径 CI 稳定，无真实账号/外网依赖。

### TEST-004 — Benchmark、baseline 与指标实现

- **Goal**：建立可审计 AI 质量评估，不伪造人工标签。
- **Input**：PRD 指标、合法来源的人工标注或明确 synthetic 数据。
- **Output**：Public Content Review Benchmark v1 Phase A：dataset schema、manifest、loader、metrics、baseline runner interface、`pr-review:eval:validate`。
- **Files**：`evals/pr-review/**`、`scripts/pr-review-eval-validate.ts`、`tests/pr-review/evaluation/**`。
- **Dependencies**：ALG-003；作为 ALG-004 前置依赖先完成 Phase A。
- **Acceptance Criteria**：至少 60 条 development cases；每条样本有 provenance/label type；公式与 PRD 一致；结果含 sample count/version；无硬编码结果。
- **Tests**：metric toy cases、dataset validation、manifest、duplicate ID、split leakage、label completeness、provenance。
- **Definition of Done**：Phase A validate command 与 tests 通过；真实 baseline run 可在 ALG-004 后执行。

### TEST-005 — 非功能与安全验证

- **Goal**：验证 timeout、恢复、数据保护、发布安全与性能采集。
- **Input**：完整 MVP、威胁模型、NFR。
- **Output**：fault/load/security test reports 和回归用例。
- **Files**：`tests/pr-review/non-functional/**`、`docs/pr-review/security/**`。
- **Dependencies**：BE-005、ALG-005、INT-001。
- **Acceptance Criteria**：依赖失败无默认通过；SSRF/输入限制/权限/secret checks；P50/P95 可计算但不预设结果。
- **Tests**：fault injection、load smoke、dependency timeout、publisher kill switch。
- **Definition of Done**：M7 风险有证据/owner/处置，阻断项关闭。

## 7. Integration Track

### INT-001 — 跨域集成与 trace 关联

- **Goal**：贯通 API、ReviewEngine、repository、HITL 和 UI，并关联 case/version/run/trace。
- **Input**：ALG-003、BE-003、FE-003、TEST-003。
- **Output**：composition root、集成配置、trace metadata 规范。
- **Files**：新 composition/config、`docs/pr-review/observability.md`。
- **Dependencies**：各 Track MVP。
- **Acceptance Criteria**：无循环依赖；一次 Case 可从 audit 跳转/定位 graph trace；敏感内容按策略脱敏。
- **Tests**：architecture dependency test、E2E trace assertions、restart resume。
- **Definition of Done**：M3/M4 集成 demo 稳定，接口变更均已同步合同。

### INT-002 — Docker、Demo 数据与一键启动

- **Goal**：提供生产近似但绝不真实发布的可复现演示。
- **Input**：集成应用、MockPublisher、明确 synthetic demo cases。
- **Output**：Docker compose、seed、启动/清理文档、health checks。
- **Files**：部署文件、`docs/pr-review/demo/**`、seed scripts。
- **Dependencies**：INT-001、TEST-003。
- **Acceptance Criteria**：一条命令启动；demo 数据标记 synthetic；无需社交凭据；默认网络/secret 安全。
- **Tests**：clean-machine smoke、health、seed idempotency、no-real-publisher assertion。
- **Definition of Done**：M7 演示可复现，README 完整，镜像构建通过。

### INT-003 — Release readiness 与兼容验收

- **Goal**：完成合同、迁移、回归、观测和运行手册的发布门禁。
- **Input**：所有 milestone 产物和测试/评估报告。
- **Output**：release checklist、known risks、rollback/runbook、签字记录。
- **Files**：`docs/pr-review/release/**`、根 README 的兼容扩展。
- **Dependencies**：INT-002、TEST-004/005。
- **Acceptance Criteria**：build/lint/test/eval smoke；generate_post 不变；Mock 默认；合同/ADR/安全风险已审。
- **Tests**：全量 CI、Docker smoke、upgrade/rollback rehearsal。
- **Definition of Done**：M7 所有门禁有证据，未完成项明确 blocker 而非静默接受。

## 8. Milestones

| Milestone                     | 交付标准                                               | 主要任务                                   |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| M0 — Repository understanding | 现状、PRD、架构、合同、任务、骨架与安全配置基线完成    | Phase 0 文档、INFRA-001/002                |
| M1 — Algorithm MVP            | 规则审核 + Mock Reviewer + LangGraph 可运行            | ALG-001..003、TEST-001/002                 |
| M2 — Business Foundation      | API DTO、Repository、Social Context、Benchmark Phase A | BE-001、BE-002、DATA-002、TEST-004 Phase A |
| M3 — Frontend MVP             | 可提交、查看、审核、修改 Case                          | FE-001..003、TEST-003                      |
| M4 — RAG & LLM Reviewer       | 品牌知识检索与结构化审核                               | ALG-004                                    |
| M5 — Multimodal               | OCR/VLM 视觉审核                                       | ALG-005                                    |
| M6 — Evaluation               | benchmark 与 baseline/enhanced 对比                    | TEST-004、FE-004                           |
| M7 — Production-like demo     | Docker 一键启动、Demo 数据、README、Trace、完整测试    | INT-001..003、TEST-005                     |

## 9. Top 10 优先任务

1. DOCS-GATE-001
2. DATA-001
3. ALG-001
4. TEST-001（与 ALG-001 并行）
5. PRODUCT-001
6. ALG-002
7. ALG-003 + TEST-002
8. BE-001
9. BE-002
10. DATA-002 + TEST-004 Phase A

INFRA-001/002 已完成，不再占用待执行 Top 10。SPRINT-004 先完成 BE-001、BE-002、DATA-002 与 TEST-004 Phase A，只有 BE-002 与 TEST-004 Phase A 验收后，ALG-004 才能从 BLOCKED 移到 READY。WorkBuddy Skill 与 CLI 作为未来 Adapter 单独立项，不绑定最终 package。Test Track 从第一天持续参与。
