# 企业公网内容 AI 多智能体审核系统 — PRD

版本：v1.1 — Five-Dimension Multi-Agent Public Content Review  
状态：PRODUCT-001 产品核心基线；指标目标值待 benchmark 后确定

## 1. 背景与目标

企业官方账号发布新闻稿、社交媒体内容、活动宣传、产品文案和危机回应前，需要多个角色审核。传统流程依赖聊天工具反复确认，版本难追踪，标准不统一；简单低风险内容也消耗全量人工，高风险问题重复发现；风险证据、审核记录、质量和人工工作量又缺乏统一统计。

系统目标不是取代最终审核人员，而是：**自动完成低风险检查，为审核人员提供风险、证据和修改建议，并对中高风险内容执行 Human-in-the-loop。**

### 1.1 范围内

- 内容提交、自检、多级审核、风险路由、版本修订、审批、模拟排期。
- 公关与舆情、运营与渠道、产品与事实、客户与用户、合规与内容安全五个一级业务风险维度。
- 可追溯证据、审计与评估。
- LOW 在严格门槛下自动流转；MEDIUM/HIGH 或低 confidence 强制人工。

### 1.2 非目标

- 不自动作出最终法律判断或替代法务/安全负责人。
- Phase 0 不实现完整 UI、数据库、RAG、OCR/VLM 或生产发布。
- 开发环境不连接真实社交账号，不以审核失败作为默认通过理由。
- 不预设、伪造或硬编码实验结果。

## 2. 用户角色

| 角色                                 | 输入                                | 权限                                 | 审核范围                                       | 可执行操作                                      | 输出                           |
| ------------------------------------ | ----------------------------------- | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| Requester / 需求方                   | brief、原始内容、平台、素材、来源   | 创建和查看本人 Case；提交新版本      | 完整性、来源、自检                             | draft、submit、revise、withdraw（仅未进入审批） | 提交 Case、自检记录、新版本    |
| Account Operator / 官方账号运营      | 已提交 Case、平台规范               | 查看分配队列；运营阶段操作           | 文案质量、平台适配、基础品牌规范               | approve、revise、reject、escalate               | 运营审核动作和意见             |
| Visual Reviewer / 视觉审核           | 图片、OCR、文案、视觉问题           | 仅含视觉素材且被分配的 Case          | 图片文字、Logo、品牌元素、图文一致性、敏感视觉 | approve、revise、reject、escalate               | 视觉结论、问题和证据           |
| Compliance Reviewer / 安全与合规审核 | 当前版本、来源、自动审核结果        | 查看合规队列；不得直接发布           | 隐私、宣传、承诺、竞品、敏感/高风险表达        | approve、revise、reject、escalate               | 人工合规意见；不是自动法律结论 |
| Media Manager / 新媒体负责人         | 全部审核与版本历史                  | 最终业务审批、排期授权               | 综合品牌、声誉、发布时机和残余风险             | approve、revise、reject、escalate、schedule     | 最终审批及模拟/正式排期指令    |
| System Administrator                 | 用户、角色、规则/知识版本、系统配置 | 配置与审计读取；默认不能代替业务审批 | 权限、策略、集成与运行健康                     | 管理角色、规则、阈值、publisher 开关；查看审计  | 配置变更审计、运行报告         |

最小权限原则：提交者不能审批自己的最终关卡；管理员配置能力不等于内容审批权；每次人工动作必须绑定 actor、角色、原因和版本。

## 3. 内容类型

- `SOCIAL_POST`：社交媒体帖文。
- `PRESS_RELEASE`：新闻稿。
- `PRODUCT_LAUNCH`：产品发布内容。
- `BRAND_CAMPAIGN`：品牌活动内容。
- `EXTERNAL_RESPONSE`：对外回应/危机声明。
- `MULTIMODAL_POST`：图文内容。

`targetPlatform` 可为一个或多个受支持平台；同一文案在不同平台存在规则差异时，应分别产生 issue，不能隐式改写。

## 4. 核心流程

```text
需求方提交 -> 需求方自检 -> 官方运营审核
  -> 是否包含视觉素材? --是--> 视觉审核 --+
                         --否---------------+
  -> 安全与合规审核 -> 风险路由 -> 新媒体负责人审批 -> 安排发布
```

任意审核节点支持：

- `approve`：确认当前版本在本节点可继续。
- `revise`：要求修改并说明原因；修改产生 `version + 1`，旧版本不可覆盖。
- `reject`：终止当前 Case，不进入发布。
- `escalate`：转交更高权限/专家，必须说明原因。

修订后默认从触发修订的最早受影响阶段重新审核；Backend 按 revision action 原子创建内容版本、审计动作并恢复 graph。并发修改使用版本前置条件，过期版本返回冲突。达到最大 revision 次数后停止自动循环并升级人工。

## 5. 风险等级与路由

| 等级   | 定义                                                                   | 路由                                                             |
| ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| LOW    | 未发现实质风险，或仅有不影响发布的低严重度提示，且证据与置信度满足策略 | 可跳过指定人工节点并自动流转；最终是否允许自动排期由组织策略决定 |
| MEDIUM | 存在需要人工语境判断、证据不完备或可修正风险                           | 必须人工审核，不得自动发布                                       |
| HIGH   | 涉及隐私、严重误导、危机/责任、敏感表达等高影响风险                    | 禁止自动发布，必须人工升级和明确批准；默认阻断                   |

confidence 为 `[0,1]` 的模型/聚合置信度，不等于内容正确率。即使 `riskLevel=LOW`，只要 confidence 低于可配置阈值、证据缺失、schema 解析失败、模型超时/失败或 reviewer 冲突，就进入人工审核。任何失败均不得降级为 approve。

## 6. 审核维度（v1.0 历史语义）

本节仅保留 v1.0 taxonomy 的迁移背景。v1.1 的事实源为第 13 节；`Fact`、`Brand`、`Compliance`、`Reputation` 继续作为二级问题语义的来源，`Visual` 不再是一级风险维度。

### 6.1 Fact

- 数据真实性与来源一致性。
- 产品能力是否有可追溯依据。
- 时间、人名、组织名。
- 引用内容及上下文。
- 无依据结论、因果关系或数字。

### 6.2 Brand

- 品牌语气和品牌价值规范。
- 官方术语、产品命名和大小写。
- 禁用表达与渠道风格。

### 6.3 Compliance

- 隐私/个人数据暴露。
- 绝对化宣传、误导性承诺。
- 竞品攻击。
- 敏感内容与潜在高风险表达。

系统仅提供风险识别、证据与建议，**不能声称自动作出最终法律判断**。不确定项应标为需人工/专家审核。

### 6.4 Reputation

- 容易引发误读或断章取义的表述。
- 情绪化回应、甩锅表达。
- 潜在舆情升级。
- 对事故责任的未经确认判断。

### 6.5 Visual（已迁移为证据能力）

- 图片文字/OCR。
- Logo、品牌元素及使用规范。
- 图文一致性。
- 潜在敏感视觉元素。

视觉模型失败或素材不可访问时，含图 Case 不得自动通过视觉节点。

## 7. 功能需求

1. 创建 Case 时保存原始内容、当前内容、内容类型、平台、图片与提交者。
2. 每次修改创建不可变 ContentVersion；Case 只保存 currentVersion 引用。
3. 每个 reviewer 输出统一 ReviewResult，可定位 textSpan、引用 evidence、提供建议。
4. 聚合器去重但不丢失 reviewer 原始结果；最高有效风险不能被平均值稀释。
5. 风险路由同时考虑 riskLevel、confidence、内容类型、证据、失败状态与组织策略。
6. 人工队列按阶段、角色、风险、更新时间筛选。
7. 所有动作进入 append-only audit timeline。
8. 最终批准后仅调用 Backend Publisher port；开发默认 MockPublisher。
9. Evaluation Dashboard 展示实验计算结果及样本范围，不展示预置结果。

## 8. 非功能需求

- **可追踪/可回放**：Case、version、graph thread/run、trace 和 reviewer result 可关联；保存 prompt/rule/model/knowledge 版本元数据，可从快照回放。
- **可解释**：风险必须尽可能包含 category、span、reason、evidence、suggestion；无证据时明确标记。
- **可中断恢复**：人工节点持久化 interrupt；重复 resume 需幂等，服务重启后可继续。
- **状态持久化**：业务事实存 repository，LangGraph checkpoint 不作为唯一业务数据库。
- **API 稳定性**：v1 DTO 向后兼容；破坏性修改需新版本、迁移计划并同步 contracts。
- **审计日志**：append-only，记录 actor、action、reason、from/to version、时间、request/trace ID；敏感字段按权限脱敏。
- **模型失败降级**：有限重试；超时、解析失败、provider 不可用统一标记为 `REVIEW_REQUIRED`，不得默认通过。
- **超时**：HTTP、单 reviewer、graph run 和人工 SLA 分开配置；超时产生可观测事件。
- **最大 revision 次数**：组织策略配置；达到上限后 `escalate`，禁止无限循环。
- **发布安全**：HIGH 禁止自动发布；开发/测试默认 MockPublisher，真实 publisher 需显式环境开关和授权。
- **安全与隐私**：最小权限、密钥只经 secret manager/env、输入大小和 URL 白名单/SSRF 防护、审计保留策略。
- **可靠性**：动作需幂等键和乐观锁；算法失败、证据失败或存储失败时 fail closed。
- **性能**：并行独立 reviewer；设定可观测的 P50/P95，不在 Phase 0 虚构目标值。

## 9. 成功指标

所有指标按内容类型、风险类别、模型/规则版本和时间窗口切片；最终数值来自版本化 benchmark、运行日志、model usage 和人工审计，不预置结果。

| 指标                      | 公式                                                                        | 数据来源                                      |
| ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| Macro-F1                  | 对 LOW/MEDIUM/HIGH（或各 issue category）分别计算 `F1=2PR/(P+R)` 后算术平均 | 有人工 gold label 的 benchmark 预测与标签     |
| High-risk Recall          | `正确预测 HIGH / 实际 HIGH`                                                 | benchmark gold label 与最终预测               |
| High-risk False Pass Rate | `实际 HIGH 且系统给出可自动通过 / 实际 HIGH`                                | benchmark + routing decision；分母为实际 HIGH |
| Manual Review Rate        | `进入任一人工审核的 Case / 已完成路由 Case`                                 | Case stage 与 interrupt/audit 事件            |
| Auto Approval Rate        | `无人工动作且按策略自动批准的 Case / 已完成路由 Case`                       | routing 与 ReviewAction；不等同于正确率       |
| Revision Rate             | `发生至少一次 revise 的 Case / 进入审核的 Case`；另报平均 revision 次数     | ContentVersion 与 ReviewAction                |
| Schema Parse Success Rate | `首次模型输出通过 schema validation 的调用 / structured-output 调用总数`    | reviewer telemetry/validation logs            |
| P50 / P95 Latency         | Case 或 reviewer latency 分布的第 50/95 百分位                              | API、graph/node trace；必须注明统计口径       |
| 平均 Token 使用量         | `所有模型 input+output tokens / 已评估 Case`，并分别报告输入/输出           | provider/LangSmith model usage                |
| 每 Case 推理成本          | `模型调用折算成本总和 / 已评估 Case`，价格表需版本化                        | model usage + 生效时点价格配置                |
| Human Override Rate       | `人工最终决定与自动建议不同的 Case / 有自动建议且经人工决定的 Case`         | ReviewResult 与 ReviewAction                  |

指标必须报告样本数、置信区间或波动范围（适用时）、数据集版本和 exclusions。上线门槛在 benchmark 建立后由产品、合规和技术共同冻结。

## 10. 验收原则

- 任一版本可还原内容、审核结果、证据和动作。
- LOW 自动路径可被策略关闭；MEDIUM/HIGH 与低 confidence 必进人工。
- 模型/解析/检索失败不会产生 approve。
- 开发默认不会触发真实社交发布。
- 软件测试通过不代表模型质量达标；两者分别验收。

## 11. Social Listening / Social Context

Social Context 是 Reputation Review 的辅助证据源，不是独立产品目标。系统可使用微博、小红书、抖音、哔哩哔哩、酷安及未来合规扩展平台的标准化讨论摘要，帮助识别当前品牌/产品负面讨论、热点事件、高频投诉主题、近期敏感关键词、典型高互动帖子和代表性评论。

- 不承诺全网、全量或实时覆盖，不建设通用舆情监控平台。
- 不把社媒讨论作为自动判定事实真假的唯一依据。
- 当待审声明与近期讨论明显不匹配时，输出 evidence mismatch、reputation risk 或 insufficient support，并建议人工确认。
- 数据缺失、过期、覆盖不足或 provider 不可用时，显式展示限制并降低 confidence/进入人工审核；不得默认通过。
- 数据来源必须是 official API、authorized export、local fixture 或 disabled；不绕过登录、验证码、访问控制、限流或反爬。

## 12. Social Data 隐私与成功边界

只收集与公关内容审核相关的最少字段。原始用户 ID 非业务必需时使用不可逆 hash 或 platform-scoped identifier，不扩展收集联系方式、画像或其他无关个人资料。Synthetic、人工整理和授权导出数据必须分别标注 provenance，禁止将 synthetic 数据描述成真实采集或人工标注事实。

Social Context 的价值通过 Reputation Reviewer 的 evidence coverage、人工 override、high-risk recall 等既有评估框架观察；DATA-001 不预设结果，也不新增硬编码 KPI。

## 13. v1.1 五个一级风险维度

`ReviewDimension` 是面向业务的一级风险域；`IssueCategory` 是可定位、可解释的二级问题分类。五个维度必须全部执行至少 LIGHT 审核，Planner 可以将相关维度升级为 FULL，但不得跳过 `COMPLIANCE_SAFETY`。

### 13.1 `PUBLIC_RELATIONS` — 公关与舆情风险

检查品牌对外口径与语气、舆情升级、危机回应、责任归因、社会热点语境、竞品攻击、容易被断章取义的内容、官方表态与近期公众认知冲突，以及媒体传播后的潜在误读。允许使用 `SocialContextProvider`、品牌知识和历史公关案例；社交媒体讨论只能作为风险证据，不能自动成为事实真假的唯一依据。

### 13.2 `OPERATIONS` — 运营与渠道风险

检查目标平台适配、账号定位、活动 brief 一致性、平台规则冲突、CTA、URL/hashtag、发布语境、素材完整性、跨平台改写和发布时间/活动冲突。允许使用 `PlatformPolicyProvider`、`CampaignBriefProvider` 与 `AccountProfileProvider`。

### 13.3 `PRODUCT` — 产品与事实风险

检查产品名称、参数、功能、价格、上市时间、软件版本、技术能力、性能与数据声明、对比声明、第三方报告引用、无依据产品声明，以及产品实际状态与宣传不一致。允许使用 `ProductKnowledgeProvider`、`ApprovedClaimsProvider` 与通用证据检索能力。

### 13.4 `CUSTOMER` — 客户与用户潜在风险

检查错误预期、客服与售后承诺、赔偿/补偿暗示、投诉敏感点、已知产品问题、用户群体冒犯、潜在负面解读、体验与宣传差距，以及可能升级投诉的表述。允许使用 `SocialContextProvider`、`CustomerFaqProvider` 与 `ServicePolicyProvider`。

### 13.5 `COMPLIANCE_SAFETY` — 合规与内容安全风险

检查广告合规、绝对化用语、误导声明、隐私、机密信息、个人信息、知识产权、敏感内容、非法/有害内容、平台内容安全规则和广告标识。系统只能输出合规风险，不得声称最终法律判断；证据不足或解释不确定时必须进入 Human Review。

## 14. 多模态证据层

Visual 从一级 Reviewer Dimension 调整为跨模态 Evidence / Analysis Capability：文本、图片、OCR、VLM 与未来视频关键帧统一产生 `EvidenceItem`，再供五个 Specialist 使用。例如图片 OCR 发现“行业第一”，应同时供 `PRODUCT` 与 `COMPLIANCE_SAFETY` 判断，而不是只产生 Visual risk。PRODUCT-001 只冻结接口；真实 OCR、VLM 和视频能力不在本轮范围。

## 15. 多智能体审核流程

```text
Input Validation
  -> Content Understanding
  -> Review Planner Agent
  -> Evidence Planning
  -> 五个 Specialist Agent 并行审核
  -> Evidence Critic Agent
  -> Decision Judge Agent
  -> Deterministic Policy Guard
  -> Revision Agent / Human-in-the-loop / Final
  -> PASS | REVISE | HUMAN_REVIEW | BLOCK
```

- Planner 输出结构化 `ReviewPlan`，决定每个维度 LIGHT/FULL 深度与必需证据来源。
- 五个 Specialist 各自输出 `DimensionReviewResult`，包含 0–100 风险分、confidence、verdict、issues、证据与修改建议。
- Evidence Critic 检查证据匹配、缺失证据、无依据结论和跨 Agent 冲突，不重新执行五维完整审核。
- Decision Judge 是 AI Agent，综合五维结果、Critic 与内容元数据，输出推荐决策、推理、主要风险和修改优先级。
- Policy Guard 是不可绕过的确定性安全边界；Judge 不能放宽 hard gate。
- Revision Agent 说明问题、原因、修改原则和建议表达，可给出 `suggestedContent`，但不得覆盖 `currentContent`；Backend 后续负责创建新 Version。

## 16. 评分与最终决策策略

MVP 默认权重为 `PUBLIC_RELATIONS=0.25`、`OPERATIONS=0.15`、`PRODUCT=0.20`、`CUSTOMER=0.20`、`COMPLIANCE_SAFETY=0.20`。权重与阈值必须通过 typed policy 注入；它们只是初始默认值，不是实验验证后的最佳参数。

初始可配置阈值：

- `PASS`：overall risk `<=25`、所有维度 `<40`、无 HIGH/CRITICAL、confidence `>=0.75` 且必需证据可用。
- `REVISE`：overall risk `26..49`，或存在可通过内容修订解决的中风险问题。
- `HUMAN_REVIEW`：高不确定性、关键证据缺失、reviewer 冲突或需要高风险语境判断。
- `BLOCK`：命中明确 hard blocker，或严重风险无法通过简单措辞修复。

最终决策不能只使用加权平均。以下 hard gate 永不允许 PASS：CRITICAL issue、HIGH 合规问题、HIGH unsupported product claim、隐私/机密泄露和 reviewer failure。必需证据不可用、低 confidence 或 specialist disagreement 超过阈值时必须进入 Evidence Critic / HUMAN_REVIEW。

## 17. Headless 核心与交付边界

同一 `ReviewEngine` 必须服务 Web Frontend、Backend API、未来 CLI 与 WorkBuddy Skill；Adapter 不得重新实现审核逻辑。未来稳定 facade 为 `reviewContent(input): Promise<FinalReviewDecision>`，CLI 目标命令为 `yarn pr-review:review --input xxx.json --json`。本轮不绑定未确认的 WorkBuddy package schema，也不实现真实 DeepSeek/Qwen、真实 RAG、真实社媒、OCR/VLM、Backend、Frontend、Publisher 或 WorkBuddy package。
