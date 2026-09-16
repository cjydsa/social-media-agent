# Social Data Domain

## 1. 目的与非目标

Social Data 为企业公网内容审核提供外部语境证据，主要服务 `PUBLIC_RELATIONS` 与 `CUSTOMER` 风险判断。它帮助识别舆情升级、用户投诉敏感点、近期公众认知、客服承诺风险与传播误读风险。

本域不是全网实时舆情系统，不承诺平台全量覆盖，不做事实最终裁决，不作为法律结论来源。

## 2. 合规边界

允许 access mode：

- `official_api`：未来仅在平台正式授权 API 明确可用时启用。
- `authorized_export`：客户或平台依法授权导出的文件。
- `local_fixture`：开发/测试使用的固定数据。
- `disabled`：当前无合规数据源。

DATA-002 只实现：

- `local_fixture`
- `authorized_export`

禁止：

- 绕过登录、验证码、rate limit、访问控制或反爬机制。
- 抓取微博、小红书、抖音、B站、酷安真实网页。
- 读取用户账号。
- 将未经授权导出伪装为 authorized export。
- 将 synthetic fixture 伪装为真实平台数据或人工标注 ground truth。

## 3. Docs-first Gate

修改任何 `src/pr-review/social-data/**`、Social Adapter、Normalization、SocialContextBuilder、fixture ingestion 或 SocialContextProvider runtime 前，必须先：

1. 创建/更新任务 Change Log。
2. 更新本文。
3. Schema/port 变化时更新 `03-contracts.md`。
4. Algorithm 消费方式变化时更新 `domains/algorithm.md`。
5. 运行对应 docs check 并输出 `DOCS GATE: PASS`。

## 4. 当前行为

截至 SPRINT-004 开始：

- ALG-001 已实现 Social schemas 与 Algorithm-facing `SocialContextProvider` port。
- 尚无 runtime `SocialDataAdapter`。
- 尚无 LocalFixture/AuthorizedExport adapter。
- 尚无 normalization、deduplication、SocialContextBuilder 或 fixture ingestion。

## 5. DATA-002 Runtime Architecture

```text
local_fixture / authorized_export
          |
          v
SocialDataAdapter
          |
          v
Normalization
          |
          v
Deduplication
          |
          v
SocialContextBuilder
          |
          v
SocialContextProvider
          |
          v
PUBLIC_RELATIONS / CUSTOMER Specialist Evidence
```

Algorithm 只能通过 `SocialContextProvider` 消费聚合后的 `SocialContextSnapshot`，不得 import 平台 Adapter 或调用平台 API。

## 6. 支持平台

DATA-002 支持以下标准平台枚举：

- `WEIBO`
- `XIAOHONGSHU`
- `DOUYIN`
- `BILIBILI`
- `COOLAPK`

ALG-001 已存在小写 platform 值。SPRINT-004 不做破坏性删除：迁移期公共 schema 接受小写和大写平台值；DATA-002 normalizer 必须把小写输入映射为大写 canonical 输出。未知平台仍然 fail，运行时聚合输出不应隐式混用大小写。

## 7. Runtime Ports

### 7.1 SocialDataAdapter

```typescript
interface SocialDataAdapter {
  readonly platform: SocialPlatform;
  readonly accessMode: SocialAccessMode;
  search(input: SocialSearchInput): Promise<SocialSearchResult>;
}
```

DATA-002 实现：

- `LocalFixtureSocialAdapter`
- `AuthorizedExportSocialAdapter`

不实现：

- `WeiboAdapter`
- `XiaohongshuAdapter`
- `DouyinAdapter`
- `BilibiliAdapter`
- `CoolapkAdapter`

上述真实平台 Connector 必须另行授权。

### 7.2 SocialContextProvider

```typescript
interface SocialContextProvider {
  getSnapshot(input: SocialContextQuery): Promise<SocialContextSnapshot>;
}
```

Provider 可以组合多个 Adapter。某个平台 unavailable 时必须在 `providerStatus` 中体现，不得返回“成功但 0 条”来掩盖不可用。

## 8. SocialContextSnapshot

DATA-002 输出至少包含：

- `query`
- `platforms`
- `timeRange`
- `mentionCount`
- `platformCoverage`
- `topTopics`
- `emergingRisks`
- `representativePosts`
- `representativeComments`
- `negativeSignals`
- `providerStatus`
- `generatedAt`

Social Context 只表达 reputation risk、evidence mismatch、customer concern 或 insufficient support。示例：如果社媒中有人抱怨续航，不得自动输出“产品续航事实错误”；应输出“存在用户关注/传播风险，需要产品证据或人工确认”。

## 9. Normalization / Deduplication

- timestamp 必须标准化为 ISO-8601。
- post/comment 文本 trim 后不能为空。
- engagement unknown 使用 `null`，不得伪造为 `0`。
- duplicate post/comment 按 `platform + id` 去重。
- author identifier 使用 hash 或平台内不可逆标识，不收集与审核无关的个人信息。
- malformed input 返回 typed adapter error。

## 10. Fixture Strategy

DATA-002 创建：

```text
evals/pr-review/fixtures/social/
  weibo/
  xiaohongshu/
  douyin/
  bilibili/
  coolapk/
```

每份 fixture 必须包含 provenance：

- `synthetic`
- `manually_curated`
- `authorized_export`

fixture 还应记录 schemaVersion、platform、accessMode、redaction note 与用途。

## 11. 测试策略

DATA-002 focused tests 覆盖：

- 统一 Adapter contract。
- empty result。
- provider unavailable。
- malformed input。
- duplicate 去重。
- timestamp normalization。
- missing engagement -> null。
- privacy/redaction。
- 五个平台 fixture ingestion。
- SocialContext coverage。
- no real network/API calls。

## 12. 与 ALG-004 的关系

DATA-002 不是所有 ALG-004 case 的硬依赖。但 PUBLIC_RELATIONS / CUSTOMER Specialist 使用 Social Context 时，必须支持 partial/unavailable/missing evidence 并 fail closed。社媒讨论不能成为产品事实或法律结论的唯一依据。
