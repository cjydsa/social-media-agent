# 当前系统分析

> 分析基线：`feat/pr-content-review-agent`，2026-08-18。本文件区分“原项目已有能力”和“企业审核新增能力”，避免重复记账。

## 1. 当前系统架构

当前仓库是以 TypeScript、LangGraph.js 和 LangGraph Server 为核心的社交媒体内容流水线，Node.js 20、ESM、严格 TypeScript。`langgraph.json` 注册 14 个 graph；主路径是：

```text
URL/Slack/curation input
  -> verify-links（抓取并验证来源）
  -> generateContentReport（LLM 营销摘要）
  -> generatePost（LLM 生成同一份 Twitter/LinkedIn 文案）
  -> condense（超过 280 字时，最多 3 次）
  -> find/generate/validate image（非 text-only）
  -> humanNode / Agent Inbox interrupt
  -> rewrite / update date / ignore / accept-or-edit
  -> schedulePost（创建延迟的 upload_post run）
  -> uploadPost（Twitter 与 LinkedIn 客户端）
```

主要层次如下：

- `src/agents/`：图、状态、节点、prompt 和部分业务逻辑。包含 generate-post、verify-links、find-and-generate-images、upload-post、curate-data、repurposer、supervisor 等。
- `src/clients/`：Twitter、LinkedIn、Slack、Reddit 及 OAuth/Arcade 适配。
- `src/utils/`：日期/排期、图片、抓取、Supabase、LangGraph 延迟恢复等工具。
- `scripts/`：调用 graph、cron、查询/删除 run/thread、重建 interrupt 等运维脚本。
- `src/tests/` 与各模块 tests：Jest 单元/集成测试；当前约 6 个非集成测试文件、25 个集成测试文件。
- `src/evals/`：Twitter/GitHub/general/e2e 和图片验证相关评估，但还不是企业审核 benchmark。
- `memory-v2/`、`slack-messaging/`：独立 Python 辅助工程，不在本次主实现边界内。

`GeneratePostAnnotation` 保存 URL、报告、文案、图片、排期、人类响应及下一节点；LangGraph checkpointer/store 由运行环境提供。Agent Inbox 不是本仓库内的前端，而是外部 UI，通过 graph ID 和 LangGraph API URL 读取 interrupted threads。

## 2. 原项目已有能力

以下均为上游已有能力，不属于本项目新增：

- 从 GitHub、Twitter、YouTube、Luma 和一般网页提取/验证内容，并进行业务相关性筛选。
- 基于报告生成、压缩和重写 Twitter/LinkedIn 文案。
- 搜索/生成图片、图片相关性筛选、图片上传处理，以及 text-only 降级。
- LangGraph 状态图、条件路由、子图、thread/run、延迟 run。
- 使用 `interrupt()` 的单节点 HITL；支持 Agent Inbox 的 accept、edit、ignore、respond。
- 使用 `Command({ resume })` 恢复执行；集成测试已有 interrupt/resume 示例。
- 自然语言修改文案或排期，无法识别的响应回到 human node。
- 调度独立 `upload_post` graph，并通过 Twitter/LinkedIn 客户端真实发布；可通过 Slack 通知结果。
- LangGraph Server/Platform 的运行、cron、状态存储和 graph 可视化基础。
- LangSmith 基础 tracing：环境变量开启自动追踪，部分 Slack、抓取、验证和 loader 方法显式使用 `traceable`；README 指引通过 LangSmith 查看运行。
- Zod + `withStructuredOutput` 已用于若干分类/路由节点，但生成报告、文案和视觉筛选仍有 XML/正则解析路径。
- Jest、ESLint、TypeScript build 和 LangGraph 配置校验。

## 3. 可以直接复用的模块

| 模块                                          | 复用方式                              | 限制                                                      |
| --------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| LangGraph `StateGraph`、interrupt/resume 模式 | 用于审核阶段暂停与恢复                | 需新建审核 graph/state，不直接扩写 generate-post state    |
| LangGraph thread/run/checkpoint               | 承载可恢复执行和 trace 关联           | 业务版本、权限和审计仍须 Backend 持久化                   |
| `HumanInterrupt` 交互结构                     | 可参考人工动作传递                    | 新系统动作是 approve/revise/reject/escalate，且按角色授权 |
| Zod structured output                         | 作为审核结果 schema validation 基础   | 所有审核输出必须统一验证，解析失败不得 approve            |
| URL 内容提取和通用抓取                        | 为 Fact evidence/retrieval 提供适配器 | 必须保存证据快照，不能只保存 URL                          |
| 图片下载、MIME 和多模态消息工具               | 视觉审核输入预处理                    | 原图片相关性模型不等同于品牌/合规视觉审核                 |
| LangSmith 自动/显式 tracing                   | graph/node/model 可观测性             | 需补 case/version/stage 标签、成本与审计关联              |
| 日期/排期工具                                 | 批准后的排期辅助                      | 发布必须经 Backend publisher port，开发默认 MockPublisher |
| 社交平台 clients                              | 将来生产 publisher adapter 的底层依赖 | Phase 0/开发环境禁止连接，不能从审核 graph 直接调用       |
| 测试配置与 graph 测试样式                     | 新测试的基础                          | AI 质量评估必须单独放在 `evals/pr-review/`                |

## 4. 不应修改的稳定模块

Phase 0 及后续默认不改以下稳定路径：

- `src/agents/generate-post/**`、`src/agents/shared/nodes/generate-post/**` 的既有生成、interrupt 和排期行为。
- `src/agents/upload-post/**` 以及 `src/clients/twitter/**`、`src/clients/linkedin.ts` 的真实发布实现。
- 现有 `langgraph.json` graph IDs 与已有 state contracts。
- 现有 prompts、URL 验证、curation/repurposer/supervisor 流程。
- `memory-v2/` 与 `slack-messaging/` 子工程。

若未来确需接入，应通过新 adapter 或新 graph 完成；对上述模块的任何修改都必须有兼容性测试和独立评审。尤其不能把审核系统默认 publisher 指向 `upload_post`。

## 5. 当前系统与目标系统之间的 Gap

| 目标                 | 当前现状                      | Gap                                               |
| -------------------- | ----------------------------- | ------------------------------------------------- |
| 多角色、多阶段审核   | 单个通用 humanNode            | 角色权限、阶段机、队列与逐级恢复                  |
| Case 生命周期        | graph state/thread            | ReviewCase 聚合、状态查询、并发控制               |
| 不可覆盖的版本历史   | 编辑直接更新 post state       | ContentVersion、diff、from/to version             |
| 多维风险审核         | 仅内容相关性/营销与图片相关性 | Fact/Brand/Compliance/Reputation/Visual reviewers |
| LOW/MEDIUM/HIGH 路由 | 无统一风险模型                | 规则、LLM 聚合、confidence 和 fail-closed policy  |
| Evidence grounding   | 报告和来源链接供生成使用      | 可引用的 EvidenceItem、文本 span、证据快照        |
| 企业知识 RAG         | 固定 LangChain prompts/示例   | 品牌知识索引、检索接口、版本/来源治理             |
| 审计                 | LangGraph trace 与日志        | 业务不可变 ReviewAction、身份、原因、版本链       |
| 稳定 Backend API     | 直接使用 LangGraph SDK        | REST DTO、错误模型、分页、幂等和鉴权              |
| 专用审核控制台       | 外部 Agent Inbox              | Dashboard、Queue、Detail、Diff、Timeline、Eval UI |
| 安全发布             | accept 后创建真实 upload run  | MockPublisher 默认、显式生产开关、HIGH 禁发       |
| 质量评估             | 零散生成/图片 eval            | 标注 benchmark、baseline/enhanced、指标和误差分析 |
| 运行保护             | 文案压缩有次数限制            | 审核 timeout、revision 上限、模型失败降级/告警    |

## 6. 真实新增工作量

本次二次开发不是“再做一个生成 Agent”，主要新增量是：

1. 建立 ReviewCase、ReviewResult、ReviewIssue、EvidenceItem、ReviewAction、ContentVersion 的领域模型和兼容策略。
2. 新建多阶段审核 LangGraph：自检、运营、可选视觉、合规、风险路由、负责人审批、排期，并支持逐节点 interrupt/resume。
3. 实现规则引擎、多个结构化 reviewer、聚合/confidence/routing、失败闭锁与 revision 限制。
4. 实现品牌知识检索和证据快照；不能把 prompt 常量当作可审计知识库。
5. 新建 Backend API、repository、权限、审计、版本和 publisher abstraction。
6. 新建 React 审核控制台，而非改造外部 Agent Inbox。
7. 建立软件测试和模型评估两套体系、真实/合成数据标识、指标采集和实验比较。
8. 完成部署、可观测性、数据迁移、隐私与真实发布安全控制。

Phase 0 只冻结上述边界、接口和任务，不实现这些业务能力。
