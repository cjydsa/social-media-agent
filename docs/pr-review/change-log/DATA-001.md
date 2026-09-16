# DATA-001 Change Log

`Documentation status: pre-implementation`

## Pre-Implementation Design

### Task ID

DATA-001

### Background

Reputation Review 需要中国大陆社交平台的外部讨论作为风险语境，但 Algorithm 不应绑定任何平台 API，项目也不应扩张为全网实时舆情系统。

### Current behavior

现有 PRD 只定义 Reputation 审核维度；没有 Social Data adapter、标准化 Schema、Context Snapshot、合规 access mode 或 fixture/contract-test 策略。

### Desired behavior

先冻结文档级 `SocialDataAdapter`、`SocialPost`、`SocialComment`、`SocialContextSnapshot` 与 `SocialContextProvider` 合同。平台数据经 Adapter、Normalization、Store、Retrieval 后形成 Snapshot，Reputation Reviewer 仅消费标准化 Snapshot。

### Files expected to change

仅 Markdown：`docs/pr-review/domains/social-data.md`、PRD、Architecture、Contracts、Development Plan、Project Board，以及 Test/Algorithm Domain 文档和本 Change Log。

### Interface changes

新增文档级 Social Data 和 Social Context ports；不新增 HTTP endpoint，不实现 TypeScript interface。

### State/schema changes

定义 SocialPost、SocialComment、SocialContextSnapshot 及 provenance/accessMode；这些是 DATA-001 设计合同，运行时实现留给后续任务。

### Error handling

future adapter 必须标准化 rate limit、provider unavailable、invalid response、malformed record 和 empty query；不可通过绕过登录、验证码、访问控制、限流或反爬获得数据。

### Test plan

预先定义各 Adapter 的统一 contract tests：必填字段、时间归一化、畸形数据、重复、缺少 engagement、限流、不可用、无效响应和空查询。单元测试只用合规 fixture，不依赖真实平台 API。

### Acceptance criteria

- 覆盖微博、小红书、抖音、哔哩哔哩、酷安的 adapter 设计状态和 access mode。
- 统一 Schema、Snapshot、Provider 边界、隐私和 fixture provenance 明确。
- Social evidence 被定义为风险证据而非事实真假的唯一依据。
- 无真实 Connector、爬虫或平台调用。

### Out of scope

实时全网监控、平台账号接入、绕过平台控制、生产 Store、真实检索、情感模型和 Reputation Reviewer 实现。

## Design changes

DATA-001 为文档任务；若设计变化，只追加记录，不覆盖上述原始设计。

## Implementation Result

- Added the Social Data Domain architecture, five future Adapter statuses, access modes, privacy rules, and fixture provenance strategy.
- Added documentation contracts for SocialPost, SocialComment, SocialDataAdapter, SocialContextSnapshot, and SocialContextProvider.
- Updated PRD, Architecture, Algorithm/Test Domain guidance, Development Plan, and Project Board.
- Defined the future shared Adapter contract-test matrix before implementation.
- No real connector, crawler, platform request, social fixture, Algorithm implementation, or publisher behavior was added.
