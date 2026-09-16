# DATA-002 — Social Context MVP

Documentation status: pre-implementation

## Task ID

DATA-002

## 背景

五维审核中的 PUBLIC_RELATIONS 与 CUSTOMER 需要社交讨论作为风险证据，但系统必须避免未经授权的抓取和平台访问绕过。DATA-001 已冻结 Social Data 合同，本任务将其升级为可运行 SocialContextProvider MVP。

## 当前行为

- Algorithm 层已有 `SocialContextProvider` port 与 Social schema。
- 尚无 `SocialDataAdapter` runtime implementation。
- 无本地 fixture ingestion、authorized export ingestion、normalization、deduplication 或 SocialContextBuilder。

## 期望行为

实现合法输入模式：

- `local_fixture`
- `authorized_export`

支持平台：

- `WEIBO`
- `XIAOHONGSHU`
- `DOUYIN`
- `BILIBILI`
- `COOLAPK`

兼容策略：ALG-001 历史 schema 已存在小写 platform 值。DATA-002 采用非破坏性迁移，公共 schema 在迁移期接受小写/大写，runtime normalizer 输出大写 canonical 平台值。

实现：

- `SocialDataAdapter` runtime port。
- `LocalFixtureSocialAdapter`。
- `AuthorizedExportSocialAdapter`。
- Normalization。
- Deduplication。
- `SocialContextBuilder`。
- `SocialContextProvider` MVP。

不实现任何未经授权网络请求。

## 预计修改文件

### 文档

- `docs/pr-review/change-log/DATA-002.md`
- `docs/pr-review/domains/social-data.md`
- `docs/pr-review/03-contracts.md`
- `docs/pr-review/05-project-board.md`

### 代码

- `src/pr-review/social-data/**`
- `src/pr-review/algorithm/schemas/social.ts`
- `src/pr-review/algorithm/ports/social-context.ts`
- `src/pr-review/algorithm/index.ts`
- `evals/pr-review/fixtures/social/**`

### 测试

- `tests/pr-review/social-data/**`

## 接口变化

新增或实现：

- `SocialDataAdapter`
- `SocialDataAdapterResult`
- `SocialContextBuilder`
- `SocialContextProvider` runtime implementation
- `SocialProviderStatus`
- `SocialPlatformCoverage`
- `SocialNegativeSignal`

`SocialContextSnapshot` 至少包含：

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

## 状态 / Schema 变化

- Social fixtures 必须记录 provenance。
- unknown engagement 使用 `null`，不得伪造 `0`。
- provider unavailable 不得表示成成功空结果。
- Social Context 只作为公关/客户风险证据，不得自动断定产品事实真伪。

## 校验规则

- platform 必须为冻结枚举。
- accessMode 必须为 `local_fixture` 或 `authorized_export`，本任务不实现 `official_api`。
- timestamp 必须能标准化为 ISO-8601。
- duplicate post/comment 按 `platform + id` 去重。
- 文本字段 trim 后不能为空。
- fixture provenance 必须为 `synthetic`、`manually_curated` 或 `authorized_export`。

## 错误处理

- malformed input 返回 typed adapter error。
- provider unavailable 进入 `providerStatus`，并向上游表达 unavailable，不得返回“成功但 0 条”的假象。
- privacy/redaction 规则保留必要审核语义，但不得输出无关个人信息。

## 测试计划

- adapter contract。
- empty result。
- provider unavailable。
- malformed input。
- duplicate deduplication。
- timestamp normalization。
- missing engagement -> null。
- privacy/redaction。
- five platform fixture ingestion。
- SocialContext coverage。
- 不发生真实网络请求。

## 验收标准

- DATA-002 focused tests 通过。
- fixtures 带 provenance。
- 支持五个平台与两种合法 access mode。
- 不实现真实平台 Adapter、crawler、scraper 或登录绕过。

## 非目标

- 不实现 official platform API。
- 不抓取微博/小红书/抖音/B站/酷安。
- 不读取用户账号。
- 不绕过验证码、登录、rate limit 或反爬。
- 不将社媒讨论作为事实真伪唯一依据。

## Implementation Result

完成 Social Context MVP：

- 公共 SocialPlatform schema 兼容 ALG-001 小写值与 SPRINT-004 大写 canonical 值。
- 新增 DATA-002 runtime port：SocialDataAdapter。
- 新增 LocalFixtureSocialAdapter。
- 新增 AuthorizedExportSocialAdapter。
- 新增 normalization、deduplication、privacy/redaction helper。
- 新增 SocialContextBuilder 与 SocialContextProviderMvp。
- 新增五个平台 synthetic local fixtures：
  - WEIBO
  - XIAOHONGSHU
  - DOUYIN
  - BILIBILI
  - COOLAPK
- provider unavailable 与成功空结果可区分。
- 未实现任何真实平台 Connector、crawler、scraper 或账号读取。

## Validation Evidence

- DATA focused tests：1 suite / 8 tests PASS。
- 覆盖 fixture provenance、五平台、empty result、provider unavailable、malformed、authorized export、dedupe、timestamp normalization、missing engagement、privacy/redaction、SocialContext coverage。
- 全部 PR Review tests：18 suites / 157 tests PASS（direct Jest，忽略 `dist` 构建产物）。
- TypeScript：`node node_modules/typescript/bin/tsc --noEmit` PASS。
- Docs Gate：`yarn pr-review:docs:check --task DATA-002` PASS（提升权限用于脚本内部 `git status`）。
