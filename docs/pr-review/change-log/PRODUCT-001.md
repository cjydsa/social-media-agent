# PRODUCT-001 变更日志

`Documentation status: pre-implementation`（文档状态：实现前设计）

## 实现前设计（Pre-Implementation Design）

### 任务编号（Task ID）

PRODUCT-001 — 五维多智能体公网内容审核产品核心重对齐

### 背景（Background）

v1.0 将 Fact、Brand、Compliance、Reputation、Visual 并列描述，容易把产品误解为一次模型调用后的标签分类。产品现正式定位为“企业公网内容 AI 多智能体审核系统”，需要 Planner、五个业务维度 Specialist、Evidence Critic、Decision Judge、deterministic Policy Guard、Revision Agent、HITL 和可回放 LangGraph。

### 当前行为（Current behavior）

ALG-001/TEST-001 已完成 legacy public contracts、ReviewEngine port、SocialContextProvider、strict Zod validation 和合同测试。尚无业务级 ReviewDimension、0–100 风险分数、最终决策合同、多智能体 graph 或 WorkBuddy packaging 边界。Visual 仍出现在 legacy IssueCategory 中，也被旧 PRD 描述为一级审核维度。

### 期望行为（Desired behavior）

- PRD 升级为 v1.1，冻结 `PUBLIC_RELATIONS`、`OPERATIONS`、`PRODUCT`、`CUSTOMER`、`COMPLIANCE_SAFETY` 五个一级业务风险维度。
- `IssueCategory` 继续作为二级问题 taxonomy；legacy values 保留兼容，新增细化类别并建立维度映射。
- Visual 改为 Multimodal Evidence Layer；OCR/VLM finding 必须归入业务维度问题，不能只输出“视觉风险”。
- 冻结 Planner→Evidence Planning→五 Specialist 并行→Critic→Judge→Policy Guard→Revision/HITL/Final 的 headless LangGraph 架构。
- 冻结 configurable scoring defaults、hard gates、FinalReviewDecision、revision 与 evidence coverage。
- 冻结 Web/Backend/CLI/WorkBuddy Skill 共用 ReviewEngine 的 adapter 边界，不绑定未知 WorkBuddy package schema。

### 预计修改文件（Files expected to change）

仅文档：`01-PRD.md`、`02-architecture.md`、`03-contracts.md`、`04-development-plan.md`、`05-project-board.md`、`08-workbuddy-skill-packaging.md`、全部 `domains/*.md`、本 Change Log，以及 ALG-002/ALG-003/TEST-002 Change Logs。

后续代码分别由 ALG-002、ALG-003、TEST-002 的实现前设计授权，PRODUCT-001 本身不授权 Backend、Frontend、真实 Provider、Social Adapter 或 WorkBuddy package 代码。

### 接口变更（Interface changes）

优先采用 additive extension：保留 legacy ReviewResult/RiskLevel/ReviewDecision；新增 ReviewDimension、ReviewPlan、DimensionReviewResult、EvidenceCriticResult、JudgeRecommendation、FinalReviewDecision、ReviewPolicy、RevisionProposal。ReviewEngineOutput 新增 optional v1.1 fields，旧 ALG-001 payload 仍可 parse。

ReviewContext `dependencies` 新增 optional evidence provider ports；provider/client 不进入 graph state。未来 headless facade `reviewContent(input): Promise<FinalReviewDecision>` 由 Backend/CLI/WorkBuddy adapter 复用，不让 adapter 重写业务逻辑。

### 状态与 Schema 变更（State/schema changes）

- Severity additive 增加 `CRITICAL`；IssueCategory 和 EvidenceSourceType additive 增加 v1.1 values。
- 枚举扩展对 exhaustive consumer 属于兼容敏感变化：旧字段不删除，消费者需升级 unknown-enum 展示/处理；服务端和测试同步更新。
- legacy `VISUAL` 值保留 parse compatibility，但 v1.1 Specialist 不再产生它作为一级业务结论；未能映射的 legacy visual finding 必须 HUMAN_REVIEW。
- ReviewEngineOutput 的 `reviewPlan`、`evidenceCriticResult`、`judgeRecommendation`、`finalDecision` 为 optional，避免破坏 ALG-001 consumers；multi-agent engine 成功执行时全部返回。

### 错误处理（Error handling）

输入/schema、reviewer、evidence、critic、judge、graph state 等失败均进入 existing ReviewFailure 并 fail closed。required evidence unavailable、low confidence、specialist conflict 或 reviewer failure 不得 PASS。Policy Guard 是 Judge 后的 deterministic safety boundary。

### 测试计划（Test plan）

PRODUCT-001 为文档/合同对齐任务；runtime 验收由 TEST-002 预先矩阵执行。先运行四个 docs checks，代码后验证 schemas、五 Specialist、hard gates、determinism、HITL、state isolation、无真实 API 和全部旧合同回归。

### 验收标准（Acceptance criteria）

- PRD、Architecture、Contracts、五个 Domain、Plan、Board 和 WorkBuddy boundary 使用完全一致的五维名称与决策语义。
- Visual 明确为 evidence capability，Social Context 明确只为风险证据。
- Planner/Critic/Judge/Policy/Revision 职责不重叠且不退化为单 Prompt 五标签。
- compatibility/migration 明确，无理由删除 ALG-001 contracts。
- 四个 Docs Gate 在代码前 PASS。

### 不在范围内（Out of scope）

真实 DeepSeek/Qwen reviewer、真实 RAG store、OCR/VLM/video、真实 Social API、Backend/Frontend/CLI/WorkBuddy package implementation、Publisher、benchmark 权重优化和 ALG-004 以后能力。

## 设计变更（Design changes）

当前无设计变更；后续只允许追加。

## Implementation Result（实施结果）

2026-08-31 本轮完成 PRODUCT-001 产品核心重对齐：

- `01-PRD.md` 已升级为 `v1.1 — Five-Dimension Multi-Agent Public Content Review`，产品定位调整为“企业公网内容 AI 多智能体审核系统”。
- 五个一级业务风险维度已冻结：`PUBLIC_RELATIONS`、`OPERATIONS`、`PRODUCT`、`CUSTOMER`、`COMPLIANCE_SAFETY`。
- `Visual` 已从一级审核维度调整为 Multimodal Evidence Layer / Analysis Capability；图片、OCR、VLM、视频关键帧的发现必须作为 evidence 输入五个业务维度。
- `IssueCategory` 保持二级问题 taxonomy；legacy Fact / Brand / Reputation / Visual 语义通过映射与细分分类兼容，不直接删除。
- Planner、五个 Specialist、Evidence Critic、Decision Judge、Policy Guard、Revision Agent、HITL、traceability 和 WorkBuddy adapter 边界已在文档中对齐。
- WorkBuddy 设计保持 headless adapter，不绑定未确认的 package schema，不重新实现审核逻辑。

## Validation Evidence（验证证据）

- 代码前已运行并通过：`yarn pr-review:docs:check --task PRODUCT-001`。
- PRODUCT-001 本身为文档/产品合同重对齐；对应 runtime 合同与 graph 能力由 ALG-002、ALG-003、TEST-002 验收。
- 本轮未调用真实 DeepSeek、Qwen、真实社媒 API 或 Publisher。
