# 跨模块合同 v1

状态：**FROZEN-v1（ALG-001 runtime baseline）**。JSON 使用 camelCase，时间为 UTC ISO-8601，ID 为不透明字符串，confidence/score 范围 `[0,1]`，固定形状的公共对象使用 strict validation 并拒绝未知字段。任何公共语义变更必须同步本文、Zod schema、contract/API tests、消费者和迁移说明。

## 1. 枚举

```ts
type ContentType =
  | "SOCIAL_POST"
  | "PRESS_RELEASE"
  | "PRODUCT_LAUNCH"
  | "BRAND_CAMPAIGN"
  | "EXTERNAL_RESPONSE"
  | "MULTIMODAL_POST";
type ReviewDecision =
  "APPROVE" | "REVISE" | "REJECT" | "ESCALATE" | "REVIEW_REQUIRED";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type IssueCategory = "FACT" | "BRAND" | "COMPLIANCE" | "REPUTATION" | "VISUAL";
type Severity = "LOW" | "MEDIUM" | "HIGH";
type ReviewerType = "RULE" | "LLM" | "VISUAL" | "HUMAN" | "AGGREGATOR";
type ReviewActionType =
  | "APPROVE"
  | "REVISE"
  | "REJECT"
  | "ESCALATE"
  | "SUBMIT"
  | "AUTO_ROUTE"
  | "SCHEDULE";
type ReviewStage =
  | "REQUESTER_SELF_CHECK"
  | "OPERATOR_REVIEW"
  | "VISUAL_REVIEW"
  | "COMPLIANCE_REVIEW"
  | "RISK_ROUTING"
  | "MEDIA_MANAGER_APPROVAL"
  | "SCHEDULING"
  | "COMPLETED"
  | "REJECTED"
  | "ESCALATED"
  | "REVIEW_REQUIRED";
```

`ReviewStage` 与 Architecture 第 7 节一致，并由 ALG-001 正式冻结。客户端必须容忍未来新增 stage 的展示降级，但不可擅自允许动作；服务端 v1 schema 对未知 stage 拒绝。

## 2. 核心 Schema

### 2.1 ReviewCase

```ts
interface ReviewCase {
  id: string;
  contentType: ContentType;
  targetPlatform: string[];
  originalContent: string;
  currentContent: string;
  imageUrls: string[];
  submitter: { id: string; displayName: string };
  version: number; // 从 1 开始，修改只递增
  currentStage: ReviewStage;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 ReviewResult

```ts
interface ReviewResult {
  decision: ReviewDecision;
  riskLevel: RiskLevel;
  confidence: number;
  issues: ReviewIssue[];
  evidence: EvidenceItem[];
  suggestedRevision: string | null;
  reviewerType: ReviewerType;
  reviewerName: string;
  latencyMs: number;
  modelUsage: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number | null;
    currency: string | null;
  };
}
```

### 2.3 ReviewIssue

```ts
interface ReviewIssue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  textSpan: { start: number; end: number; quote: string } | null;
  reason: string;
  evidenceIds: string[];
  suggestion: string | null;
}
```

span 使用当前内容的 UTF-16 code-unit、左闭右开 `[start,end)` 索引；`quote === currentContent.slice(start,end)`。视觉 issue 可设 `textSpan=null`，并在 evidence 中定位素材。

### 2.4 EvidenceItem

```ts
interface EvidenceItem {
  id: string;
  sourceType:
    | "SUBMITTED_SOURCE"
    | "BRAND_KNOWLEDGE"
    | "RULE"
    | "WEB"
    | "IMAGE"
    | "OCR"
    | "HUMAN";
  title: string;
  content: string;
  source: string;
  score: number | null;
}
```

`content` 是审核时证据快照或安全摘要；`source` 是 URI/规则 ID/文档 ID，不得只存易变 URL 而不留快照/hash（持久化层可附加元数据）。

### 2.5 ReviewAction

```ts
interface ReviewAction {
  actor: { id: string; displayName: string; role: string };
  action: ReviewActionType;
  reason: string;
  fromVersion: number | null;
  toVersion: number | null;
  timestamp: string;
}
```

ReviewAction append-only。REVISE 必须满足 `toVersion = fromVersion + 1`；其他动作通常 `fromVersion === toVersion`。

### 2.6 Runtime validation policy（ALG-001）

- Zod schema 是公共领域对象的 runtime source of truth；TypeScript 类型使用 `z.infer` 从同一 schema 推导。不得同时维护手写 `interface ReviewResult` 与独立 `ReviewResultSchema`。
- 所有固定形状的公共对象及其固定 nested object 均为 strict object，未知字段 validation fail。明确设计为 map 的 `traceMetadata` 与 `ReviewFailure.details` 不属于未知字段吞弃：key 被保留，value 受合同类型约束。
- 所有 ID 字段 trim 后必须非空；runtime schema 返回 trim 后的 ID。普通说明文字是否允许空字符串以各字段规则为准。
- timestamp 必须是带显式时区的有效 ISO-8601 timestamp；跨模块 JSON 规范化为 UTC。
- `version` 是 `>= 1` 的整数。
- `confidence` 为闭区间 `[0,1]`；`EvidenceItem.score` 为 `null` 或 `[0,1]`。
- `latencyMs >= 0`；`inputTokens` / `outputTokens` 为非负整数；`estimatedCost` 为 `null` 或非负数。
- `ReviewIssue.textSpan.start/end` 为整数，`start >= 0` 且 `end > start`。standalone schema 只验证结构；基于内容的 `end <= currentContent.length` 与 `quote === currentContent.slice(start,end)` 必须调用 `validateReviewResultAgainstContent(result, currentContent)`。offset 使用 JavaScript UTF-16 code unit 和左闭右开 `[start,end)`，包括 surrogate pair。
- `ReviewAction` 的 `REVISE` 必须同时提供非 null `fromVersion`/`toVersion` 且 `toVersion = fromVersion + 1`。

## 3. 通用 HTTP 约定

- Base path：`/api`；JSON `Content-Type: application/json`。
- 所有 mutation 接受 `Idempotency-Key` header；revise/审批动作在 body 传 `expectedVersion`。
- 分页：`limit`（默认 20、最大 100）和 opaque `cursor`。
- 成功 envelope：单项 `{ data: ... }`；列表 `{ data: [...], page: { nextCursor } }`。
- 错误 envelope：

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Case version changed",
    "details": { "currentVersion": 3 },
    "requestId": "req_123"
  }
}
```

主要状态码：400 校验失败、401 未认证、403 无权限、404 不存在、409 版本/阶段冲突、422 领域动作不可执行、429 限流、503 算法/依赖不可用。算法不可用不得返回成功 APPROVE。

## 4. API Contract

### 4.1 `POST /api/reviews`

请求：

```json
{
  "contentType": "SOCIAL_POST",
  "targetPlatform": ["LINKEDIN", "X"],
  "content": "We are launching Product A today.",
  "imageUrls": [],
  "sourceUrls": ["https://example.com/product-a"]
}
```

响应 `201`：

```json
{
  "data": {
    "case": {
      "id": "case_01",
      "contentType": "SOCIAL_POST",
      "targetPlatform": ["LINKEDIN", "X"],
      "originalContent": "We are launching Product A today.",
      "currentContent": "We are launching Product A today.",
      "imageUrls": [],
      "submitter": { "id": "usr_1", "displayName": "Requester A" },
      "version": 1,
      "currentStage": "REQUESTER_SELF_CHECK",
      "createdAt": "2026-08-18T02:00:00.000Z",
      "updatedAt": "2026-08-18T02:00:00.000Z"
    }
  }
}
```

submitter 来自认证上下文，不接受客户端伪造。创建返回后算法可异步运行；状态由 GET 查询。

### 4.2 `GET /api/reviews/:id`

响应 `200`：

```json
{
  "data": {
    "case": {
      "id": "case_01",
      "contentType": "SOCIAL_POST",
      "targetPlatform": ["LINKEDIN"],
      "originalContent": "Original",
      "currentContent": "Current",
      "imageUrls": [],
      "submitter": { "id": "usr_1", "displayName": "Requester A" },
      "version": 2,
      "currentStage": "COMPLIANCE_REVIEW",
      "createdAt": "2026-08-18T02:00:00.000Z",
      "updatedAt": "2026-08-18T03:00:00.000Z"
    },
    "latestReview": {
      "decision": "REVIEW_REQUIRED",
      "riskLevel": "MEDIUM",
      "confidence": 0.71,
      "issues": [],
      "evidence": [],
      "suggestedRevision": null,
      "reviewerType": "AGGREGATOR",
      "reviewerName": "risk-aggregator-v1",
      "latencyMs": 82,
      "modelUsage": {
        "model": null,
        "inputTokens": 0,
        "outputTokens": 0,
        "estimatedCost": null,
        "currency": null
      }
    },
    "allowedActions": ["APPROVE", "REVISE", "REJECT", "ESCALATE"]
  }
}
```

`allowedActions` 由 Backend 权限与当前 stage 计算，Frontend 不自行推断。

### 4.3 `GET /api/reviews`

请求 query 示例：`?stage=COMPLIANCE_REVIEW&riskLevel=HIGH&assignee=me&limit=20&cursor=opaque`。

响应 `200`：

```json
{
  "data": [
    {
      "id": "case_01",
      "contentType": "SOCIAL_POST",
      "targetPlatform": ["LINKEDIN"],
      "originalContent": "Original",
      "currentContent": "Current",
      "imageUrls": [],
      "submitter": { "id": "usr_1", "displayName": "Requester A" },
      "version": 2,
      "currentStage": "COMPLIANCE_REVIEW",
      "createdAt": "2026-08-18T02:00:00.000Z",
      "updatedAt": "2026-08-18T03:00:00.000Z"
    }
  ],
  "page": { "nextCursor": null }
}
```

### 4.4 `POST /api/reviews/:id/approve`

请求：

```json
{
  "expectedVersion": 2,
  "reason": "Evidence verified; approved for this stage."
}
```

响应 `200`：

```json
{
  "data": {
    "caseId": "case_01",
    "version": 2,
    "action": "APPROVE",
    "currentStage": "MEDIA_MANAGER_APPROVAL",
    "status": "ACCEPTED"
  }
}
```

### 4.5 `POST /api/reviews/:id/revise`

请求：

```json
{
  "expectedVersion": 2,
  "reason": "Replace the unsupported claim.",
  "revisedContent": "Product A is available to selected customers.",
  "imageUrls": []
}
```

响应 `200`：

```json
{
  "data": {
    "caseId": "case_01",
    "fromVersion": 2,
    "toVersion": 3,
    "action": "REVISE",
    "currentStage": "OPERATOR_REVIEW",
    "status": "ACCEPTED"
  }
}
```

原内容不覆盖；服务端在事务中创建 v3。`revisedContent` 不能为空且必须与 v2 有实质差异。

### 4.6 `POST /api/reviews/:id/reject`

请求：

```json
{ "expectedVersion": 3, "reason": "Claim cannot be substantiated." }
```

响应 `200`：

```json
{
  "data": {
    "caseId": "case_01",
    "version": 3,
    "action": "REJECT",
    "currentStage": "REJECTED",
    "status": "ACCEPTED"
  }
}
```

### 4.7 `POST /api/reviews/:id/escalate`

请求：

```json
{
  "expectedVersion": 3,
  "reason": "Potential legal interpretation requires specialist review.",
  "targetRole": "COMPLIANCE_REVIEWER"
}
```

响应 `200`：

```json
{
  "data": {
    "caseId": "case_01",
    "version": 3,
    "action": "ESCALATE",
    "currentStage": "ESCALATED",
    "status": "ACCEPTED"
  }
}
```

### 4.8 `GET /api/reviews/:id/history`

响应 `200`：

```json
{
  "data": {
    "caseId": "case_01",
    "versions": [
      {
        "version": 1,
        "content": "Original",
        "imageUrls": [],
        "createdBy": { "id": "usr_1", "displayName": "Requester A" },
        "createdAt": "2026-08-18T02:00:00.000Z"
      },
      {
        "version": 2,
        "content": "Current",
        "imageUrls": [],
        "createdBy": { "id": "usr_2", "displayName": "Operator B" },
        "createdAt": "2026-08-18T03:00:00.000Z"
      }
    ],
    "actions": [
      {
        "actor": {
          "id": "usr_2",
          "displayName": "Operator B",
          "role": "ACCOUNT_OPERATOR"
        },
        "action": "REVISE",
        "reason": "Clarify claim",
        "fromVersion": 1,
        "toVersion": 2,
        "timestamp": "2026-08-18T03:00:00.000Z"
      }
    ]
  }
}
```

### 4.9 `GET /api/evaluations/latest`

响应 `200`（仅返回真实已完成运行；没有运行时 `data:null`）：

```json
{
  "data": {
    "runId": "eval_01",
    "datasetVersion": "benchmark-2026-08-v1",
    "algorithmVersion": "review-engine-v1",
    "status": "COMPLETED",
    "sampleCount": 120,
    "startedAt": "2026-08-18T01:00:00.000Z",
    "completedAt": "2026-08-18T01:30:00.000Z",
    "metrics": {
      "macroF1": null,
      "highRiskRecall": null,
      "highRiskFalsePassRate": null,
      "manualReviewRate": null,
      "autoApprovalRate": null,
      "revisionRate": null,
      "schemaParseSuccessRate": null,
      "p50LatencyMs": null,
      "p95LatencyMs": null,
      "averageTokensPerCase": null,
      "averageCostPerCase": null,
      "humanOverrideRate": null
    }
  }
}
```

示例中的 `null` 表示指标尚未计算/不适用，不是预期结果。生产响应对已计算指标返回 number，并附评估配置/样本范围。

## 5. Algorithm/Backend 合同

### 5.1 ReviewEngine Public Port（ALG-001）

Backend 提供当前 case/version snapshot；Algorithm 不自行读取业务数据库，也不接收 HTTP request、response 或数据库 client。ALG-001 只冻结以下 public port，不实现 graph、reviewer、aggregate、routing、checkpoint 或 resume workflow：

```typescript
interface ReviewEngine {
  review(
    input: ReviewEngineInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;
  resume(
    input: ResumeReviewInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;
}
```

Backend 只依赖此 port 与公开 schema，不 import graph、reviewer、prompt 或 routing internals。

### 5.2 `ReviewEngineInput`

```typescript
interface ReviewEngineInput {
  caseId: string;
  version: number;
  contentType: ContentType;
  targetPlatform: string[];
  currentContent: string;
  imageUrls: string[];
  currentStage: ReviewStage;
  policyVersion: string;
}
```

该对象是 Algorithm 所需的不可变当前版本 snapshot。`originalContent` 不在 ALG-001 input：本轮没有 diff/revision algorithm，审核只针对 `currentContent`；未来若 Algorithm 需要原文，必须先走合同变更。不得传 HTTP 对象，也不得让 Algorithm 自行补查业务数据库。

### 5.3 `ReviewContext`

```typescript
interface CancellationSignal {
  readonly aborted: boolean;
  throwIfAborted(): void;
}

interface ReviewContext {
  requestId: string;
  deadlineAt: string | null;
  traceMetadata: Record<string, string | number | boolean | null>;
  cancellation: CancellationSignal | null;
  dependencies: {
    socialContextProvider: SocialContextProvider | null;
  };
}
```

这是进程内 Algorithm runtime context，不是 HTTP/JSON transport DTO。top-level 和 `dependencies` 是 strict object；capability objects 由 runtime shape check 验证。不得包含 Express Request/Response、database client、Frontend state、Secret、完整待审 content 或 provider SDK client。`traceMetadata` 仅允许已脱敏 scalar correlation metadata，不允许 credentials/PII/content。LLM model 仍只能由统一 `createReviewModel(config.llm)` factory 构造，不通过 context 注入 provider SDK。

### 5.4 `ReviewEngineOutput`

```typescript
interface ReviewEngineOutput {
  caseId: string;
  version: number;
  results: ReviewResult[];
  aggregateResult: ReviewResult | null;
  nextStage: ReviewStage;
  requiresHuman: boolean;
  interrupt: InterruptDescriptor | null;
  execution: ExecutionReference;
  failures: ReviewFailure[];
}
```

`aggregateResult` 可为 `null`，用于在聚合前即失败的合法表达；ALG-001 不计算 aggregate，ALG-003 才实现聚合/路由语义。`results` 保留 individual validated results。`failures` 非空不得被任何消费者解释或改写为 APPROVE。

### 5.5 `ResumeReviewInput`

Resume input 是 strict discriminated union，只冻结 HITL 恢复所需数据：

```typescript
type ResumeActor = { id: string; displayName: string; role: string };

type ResumeReviewInput =
  | {
      executionId: string;
      caseId: string;
      version: number;
      action: "REVISE";
      actor: ResumeActor;
      reason: string;
      revisedContent: string;
    }
  | {
      executionId: string;
      caseId: string;
      version: number;
      action: "APPROVE" | "REJECT" | "ESCALATE";
      actor: ResumeActor;
      reason: string;
      revisedContent: null;
    };
```

ID、actor role、reason trim 后非空；`REVISE.revisedContent` trim 后非空。ALG-001 不验证 Backend 权限、不创建版本，也不执行 resume。

### 5.6 `InterruptDescriptor` and `ExecutionReference`

```typescript
interface InterruptDescriptor {
  type: "HUMAN_REVIEW";
  stage: ReviewStage;
  allowedActions: Array<"APPROVE" | "REVISE" | "REJECT" | "ESCALATE">;
  reason: string;
  requiredRole: string;
}

interface ExecutionReference {
  executionId: string;
  threadId: string;
  runId: string | null;
}
```

Interrupt 只描述为何等待人工；实际 allowed actions 仍由 Backend 根据 actor/stage/version 权限收窄。Execution reference 仅为后续 LangGraph checkpoint/run/trace correlation 冻结最小字段，ALG-001 不创建 checkpoint。

### 5.7 Typed failure

Architecture 中的 model/retrieval/visual/schema 等内部原因在 public boundary 归一为以下稳定 taxonomy；具体子原因可放在 `source` 和安全 `details` 中：

```typescript
type ReviewFailureCode =
  | "INVALID_INPUT"
  | "SCHEMA_VALIDATION_FAILED"
  | "DEPENDENCY_UNAVAILABLE"
  | "TIMEOUT"
  | "CANCELLED"
  | "REVIEWER_FAILED"
  | "INTERNAL_ERROR";

type ReviewFailureSource =
  | "INPUT"
  | "REVIEW_ENGINE"
  | "RULE"
  | "MODEL"
  | "RETRIEVAL"
  | "VISUAL"
  | "SOCIAL_CONTEXT"
  | "POLICY";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface ReviewFailure {
  code: ReviewFailureCode;
  message: string;
  retryable: boolean;
  source: ReviewFailureSource;
  details: Record<string, JsonValue> | null;
}
```

`message` trim 后非空；`details` 只能包含 JSON-safe values，不得包含 Secret 或未脱敏 private content。异常可由未来实现映射为此结构，但 ALG-001 不添加 catch/retry/routing。Failure 绝不自动转换为 LOW 或 APPROVE。

### 5.8 Output example

Algorithm 返回 validated output 或 typed failure：

```json
{
  "caseId": "case_01",
  "version": 2,
  "results": [],
  "aggregateResult": {
    "decision": "REVIEW_REQUIRED",
    "riskLevel": "MEDIUM",
    "confidence": 0.71,
    "issues": [],
    "evidence": [],
    "suggestedRevision": null,
    "reviewerType": "AGGREGATOR",
    "reviewerName": "risk-aggregator-v1",
    "latencyMs": 82,
    "modelUsage": {
      "model": null,
      "inputTokens": 0,
      "outputTokens": 0,
      "estimatedCost": null,
      "currency": null
    }
  },
  "nextStage": "COMPLIANCE_REVIEW",
  "requiresHuman": true,
  "interrupt": {
    "type": "HUMAN_REVIEW",
    "stage": "COMPLIANCE_REVIEW",
    "allowedActions": ["APPROVE", "REVISE", "REJECT", "ESCALATE"],
    "reason": "Compliance review is required.",
    "requiredRole": "COMPLIANCE_REVIEWER"
  },
  "execution": {
    "executionId": "exec_01",
    "threadId": "thread_case_01_v2",
    "runId": null
  },
  "failures": []
}
```

若 `failures` 非空，routing 必须按策略进入人工/阻断，Backend 不得将它改写为 APPROVE。

## 6. Social Data / Social Context 合同（DATA-001）

本节由 DATA-001 冻结为文档合同。ALG-001 将枚举和所有纯数据对象实现为 strict Zod runtime schemas，并实现 Algorithm-facing `SocialContextProvider` TypeScript port；`SocialDataAdapter` runtime port、Normalization、Store、Retrieval 和任何平台 Adapter/Connector 仍留给 DATA-002。ALG-001 不新增 HTTP endpoint。所有时间为有效 ISO-8601 UTC 字符串；计数为非负整数，未知使用 `null`，不得用 `0` 代替 unknown。

### 6.1 枚举

```typescript
type SocialPlatform =
  "weibo" | "xiaohongshu" | "douyin" | "bilibili" | "coolapk";

type SocialAccessMode =
  "official_api" | "authorized_export" | "local_fixture" | "disabled";

type FixtureProvenance = "synthetic" | "manually_curated" | "authorized_export";

type SocialMediaType = "text" | "image" | "video" | "mixed" | "unknown";

type SocialProviderStatus = "available" | "partial" | "unavailable";
```

### 6.2 `SocialPost`

```typescript
interface SocialPost {
  platform: SocialPlatform;
  postId: string;
  canonicalUrl: string | null;
  title: string | null;
  text: string;
  mediaType: SocialMediaType;
  publishedAt: string;
  collectedAt: string;
  author: {
    authorIdHash: string;
    displayName: string | null;
    verifiedType: string | null;
  };
  engagement: {
    likes: number | null;
    comments: number | null;
    shares: number | null;
    favorites: number | null;
    views: number | null;
  };
  context: {
    hashtags: string[];
    keywords: string[];
    topic: string | null;
    language: string;
  };
  source: {
    accessMode: SocialAccessMode;
    sourceAdapter: string;
    fetchedAt: string;
  };
}
```

`authorIdHash` 必须是不可逆 hash 或 platform-scoped identifier；不得因本合同扩展保存无关个人资料。

### 6.3 `SocialComment`

```typescript
interface SocialComment {
  platform: SocialPlatform;
  commentId: string;
  postId: string;
  authorIdHash: string;
  text: string;
  publishedAt: string;
  likes: number | null;
  source: {
    accessMode: SocialAccessMode;
    sourceAdapter: string;
    fetchedAt: string;
  };
}
```

### 6.4 `SocialDataAdapter`

```typescript
interface SocialSearchInput {
  query: string;
  timeRange: { from: string; to: string };
  limit: number;
}

interface SocialSearchResult {
  platform: SocialPlatform;
  accessMode: SocialAccessMode;
  posts: SocialPost[];
  comments: SocialComment[];
  collectedAt: string;
  truncated: boolean;
  nextCursor: string | null;
  providerStatus: SocialProviderStatus;
}

interface SocialDataAdapter {
  readonly platform: SocialPlatform;
  readonly accessMode: SocialAccessMode;
  search(input: SocialSearchInput): Promise<SocialSearchResult>;
}
```

ALG-001 只实现 `SocialSearchInput` / `SocialSearchResult` 数据 schema，不实现上述 `SocialDataAdapter` runtime port。DATA-002 在独立 Docs Gate 后实现 port 与 Adapter behavior。

`SocialSearchInput.query` trim 后必须非空；`limit` 是 `>= 1` 的整数。空 query 属于输入校验失败，不得请求 provider。`timeRange.from/to` 都必须是带显式时区的有效 ISO-8601 timestamp；ALG-001 不新增 from/to 先后顺序约束。

错误必须区分 `RATE_LIMITED`、`PROVIDER_UNAVAILABLE`、`INVALID_RESPONSE`、`UNAUTHORIZED`、`ADAPTER_DISABLED` 和输入校验错误。Provider error 不得降级为成功空结果。

### 6.5 `SocialContextSnapshot`

```typescript
interface SocialContextSnapshot {
  query: string;
  platforms: SocialPlatform[];
  timeRange: { from: string; to: string };
  mentionCount: number;
  sentimentDistribution: {
    positive: number | null;
    neutral: number | null;
    negative: number | null;
    unknown: number | null;
  };
  topTopics: Array<{ topic: string; count: number; evidenceIds: string[] }>;
  emergingRisks: Array<{
    label: string;
    reason: string;
    evidenceIds: string[];
  }>;
  representativePosts: SocialPost[];
  representativeComments: SocialComment[];
  evidenceIds: string[];
  generatedAt: string;
  coverage: {
    requestedPlatforms: SocialPlatform[];
    availablePlatforms: SocialPlatform[];
    unavailablePlatforms: SocialPlatform[];
    isPartial: boolean;
  };
}

interface SocialContextQuery {
  query: string;
  platforms: SocialPlatform[];
  timeRange: { from: string; to: string };
}

interface SocialContextProvider {
  getSnapshot(input: SocialContextQuery): Promise<SocialContextSnapshot>;
}
```

Algorithm 仅消费 `SocialContextProvider`。Snapshot 是 Reputation evidence，不是 Fact 的唯一真相源；partial/unavailable 必须保留并影响 confidence/routing。

`coverage.requestedPlatforms`、`availablePlatforms`、`unavailablePlatforms` 必须显式表达覆盖；`isPartial` 必须与调用方语义一致，具体跨数组一致性由 DATA-002 provider behavior 测试冻结。ALG-001 只验证 shape、enum、strict、timestamp、ID 与数值边界。Provider unavailable 不得伪装成 `providerStatus="available"` 的成功空结果；Adapter 的 typed error 行为留给 DATA-002。

## 7. v1.1 五维多智能体合同扩展（PRODUCT-001）

本节是对 v1 的 additive extension。ALG-001 的 `ReviewResult`、`RiskLevel`、`ReviewDecision`、既有字段和既有枚举值均保留。v1.1 不把 legacy `ReviewDecision` 改名；最终发布建议使用独立的 `FinalDecision`，避免旧消费者误解。

### 7.1 兼容与迁移

- `Severity` 增加 `CRITICAL`。这是 wire-format additive，但对 TypeScript exhaustive switch 属于兼容敏感变更；消费者必须增加 unknown/fallback 或显式处理 `CRITICAL`。
- `IssueCategory` 保留 `FACT`、`BRAND`、`COMPLIANCE`、`REPUTATION`、`VISUAL` 并增加第 7.2 节细分类。旧 payload 可继续 parse；新消费者应优先使用细分类。
- `VISUAL` 仅保留历史 payload parse compatibility，不再代表一级业务维度。v1.1 新结果必须把视觉 finding 映射为具体业务 category/dimension；无法可靠映射时进入 `HUMAN_REVIEW`。
- `ReviewEngineInput.originalContent` 与 `ReviewEngineOutput` 的 v1.1 字段均为 optional，因此旧调用方不需要立刻迁移。多智能体实现成功返回时必须填充全部 v1.1 output 字段。
- 所有新增固定对象继续使用 strict Zod object；类型由 `z.infer` 推导。未知字段、非法枚举、越界分数或空 ID 均失败。

### 7.2 一级维度与二级问题 taxonomy

```typescript
type ReviewDimension =
  | "PUBLIC_RELATIONS"
  | "OPERATIONS"
  | "PRODUCT"
  | "CUSTOMER"
  | "COMPLIANCE_SAFETY";

type IssueCategoryV11 =
  // v1 legacy values, retained
  | "FACT"
  | "BRAND"
  | "COMPLIANCE"
  | "REPUTATION"
  | "VISUAL"
  // PUBLIC_RELATIONS
  | "BRAND_VOICE"
  | "PUBLIC_SENTIMENT"
  | "CRISIS_RESPONSE"
  | "RESPONSIBILITY_ATTRIBUTION"
  | "COMPETITOR_ATTACK"
  | "CONTEXTUAL_MISINTERPRETATION"
  // OPERATIONS
  | "PLATFORM_SUITABILITY"
  | "ACCOUNT_POSITIONING"
  | "CAMPAIGN_CONSISTENCY"
  | "PLATFORM_RULE"
  | "CTA_URL_HASHTAG"
  | "ASSET_COMPLETENESS"
  | "CROSS_PLATFORM_ADAPTATION"
  | "PUBLISHING_CONTEXT"
  // PRODUCT
  | "PRODUCT_NAME"
  | "PRODUCT_SPECIFICATION"
  | "PRODUCT_CAPABILITY"
  | "PRODUCT_PRICE"
  | "PRODUCT_AVAILABILITY"
  | "PRODUCT_VERSION"
  | "PERFORMANCE_CLAIM"
  | "DATA_CLAIM"
  | "COMPARATIVE_CLAIM"
  | "THIRD_PARTY_CITATION"
  | "UNSUPPORTED_PRODUCT_CLAIM"
  // CUSTOMER
  | "CUSTOMER_EXPECTATION"
  | "SERVICE_COMMITMENT"
  | "AFTER_SALES_COMMITMENT"
  | "COMPENSATION_IMPLICATION"
  | "CUSTOMER_COMPLAINT_SENSITIVITY"
  | "KNOWN_PRODUCT_ISSUE"
  | "AUDIENCE_OFFENSE"
  | "EXPERIENCE_GAP"
  | "COMPLAINT_ESCALATION"
  // COMPLIANCE_SAFETY
  | "ADVERTISING_COMPLIANCE"
  | "ABSOLUTE_MARKETING_CLAIM"
  | "MISLEADING_CLAIM"
  | "PRIVACY"
  | "CONFIDENTIAL_INFORMATION"
  | "PERSONAL_INFORMATION"
  | "INTELLECTUAL_PROPERTY"
  | "SENSITIVE_CONTENT"
  | "ILLEGAL_HARMFUL_CONTENT"
  | "PLATFORM_CONTENT_SAFETY"
  | "ADVERTISEMENT_IDENTIFICATION";
```

Legacy 映射为：`FACT -> PRODUCT`、`BRAND/REPUTATION -> PUBLIC_RELATIONS`、`COMPLIANCE -> COMPLIANCE_SAFETY`。`VISUAL` 没有固定业务维度，必须依据实际 finding 映射。新增细分类按上方分组映射；一个证据可以被多个维度引用，但每个 `DimensionReviewResult.dimension` 只能是一个维度。

### 7.3 Planner 合同

```typescript
type ReviewDepth = "LIGHT" | "FULL";

type ReviewEvidenceSource =
  | "BRAND_KNOWLEDGE"
  | "HISTORICAL_PR_CASES"
  | "PLATFORM_POLICY"
  | "CAMPAIGN_BRIEF"
  | "ACCOUNT_PROFILE"
  | "PRODUCT_KNOWLEDGE"
  | "APPROVED_CLAIMS"
  | "SOCIAL_CONTEXT"
  | "CUSTOMER_FAQ"
  | "SERVICE_POLICY"
  | "MULTIMODAL_EVIDENCE";

interface ReviewPlan {
  requiredDimensions: ReviewDimension[];
  reviewDepthByDimension: {
    PUBLIC_RELATIONS: ReviewDepth;
    OPERATIONS: ReviewDepth;
    PRODUCT: ReviewDepth;
    CUSTOMER: ReviewDepth;
    COMPLIANCE_SAFETY: ReviewDepth;
  };
  requiredEvidenceSources: ReviewEvidenceSource[];
  requiresSocialContext: boolean;
  requiresProductKnowledge: boolean;
  requiresPlatformPolicy: boolean;
  requiresVisualAnalysis: boolean;
  planningReason: string;
}
```

`requiredDimensions` 必须恰好包含五个不重复维度；每个公网内容至少执行 LIGHT，Planner 可以升级为 FULL，不得跳过 `COMPLIANCE_SAFETY`。reason trim 后非空。

### 7.4 Specialist 合同

```typescript
type DimensionVerdict = "PASS" | "WARN" | "BLOCK" | "REVIEW_REQUIRED";

interface DimensionReviewResult {
  dimension: ReviewDimension;
  riskScore: number;
  confidence: number;
  verdict: DimensionVerdict;
  reason: string;
  issues: ReviewIssue[];
  evidenceIds: string[];
  missingEvidence: ReviewEvidenceSource[];
  suggestedChanges: string[];
}
```

`riskScore` 为闭区间 `[0,100]`，越高代表风险越高；`confidence` 为 `[0,1]`。ID trim 后非空，固定 nested object strict。`missingEvidence` 非空不得被解释为证据充分。

### 7.5 Evidence Critic、Judge 与 Revision

```typescript
interface EvidenceConflict {
  dimensions: ReviewDimension[];
  reason: string;
  evidenceIds: string[];
}

interface EvidenceCriticResult {
  supportedIssueIds: string[];
  unsupportedIssueIds: string[];
  conflicts: EvidenceConflict[];
  missingEvidence: ReviewEvidenceSource[];
  requiresHuman: boolean;
  reason: string;
}

type FinalDecision = "PASS" | "REVISE" | "HUMAN_REVIEW" | "BLOCK";

interface JudgeRecommendation {
  decision: FinalDecision;
  overallRiskScore: number;
  confidence: number;
  summary: string;
  topRisks: string[];
  revisionPriority: string[];
  judgeReason: string;
}

interface RevisionProposalIssue {
  issueId: string;
  category: IssueCategory;
  reason: string;
}

interface RevisionProposal {
  issues: RevisionProposalIssue[];
  revisionDirection: string[];
  suggestedContent: string | null;
  reason: string;
}
```

Critic 只审查 evidence/结论/冲突，不重新执行五维审核。Revision Agent 不得修改 input/current state 正文；`suggestedContent` 仅是候选，Backend 必须通过新 Version 接受修改。

### 7.6 最终决策与 evidence coverage

```typescript
interface EvidenceCoverage {
  requiredSources: ReviewEvidenceSource[];
  availableSources: ReviewEvidenceSource[];
  missingSources: ReviewEvidenceSource[];
  coverageScore: number;
}

interface FinalReviewDecision {
  decision: FinalDecision;
  publishable: boolean;
  overallRiskScore: number;
  confidence: number;
  summary: string;
  dimensionResults: DimensionReviewResult[];
  blockingIssues: ReviewIssue[];
  revisionDirection: string[];
  evidenceCoverage: EvidenceCoverage;
  judgeReason: string;
}
```

`overallRiskScore` 为 `[0,100]`，coverage/confidence 为 `[0,1]`。`dimensionResults` 必须恰好包含五个不重复维度。只有 `decision="PASS"` 时 `publishable=true`；其他决策必须为 false。

### 7.7 可配置 MVP Policy

```typescript
interface ReviewPolicy {
  weights: {
    PUBLIC_RELATIONS: number;
    OPERATIONS: number;
    PRODUCT: number;
    CUSTOMER: number;
    COMPLIANCE_SAFETY: number;
  };
  thresholds: {
    passOverallMax: number;
    passDimensionMaxExclusive: number;
    reviseOverallMax: number;
    minimumConfidence: number;
    disagreementThreshold: number;
  };
  maxRevisionCount: number;
}
```

默认权重为 0.25/0.15/0.20/0.20/0.20 且和必须为 1；默认阈值为 25、40（exclusive）、49、0.75，冲突阈值与最大 revision 次数由 typed config 注入。所有值均是 MVP defaults，不是 benchmark 结论。

Hard gates：CRITICAL issue、HIGH 合规问题、HIGH `UNSUPPORTED_PRODUCT_CLAIM`、`PRIVACY`/`CONFIDENTIAL_INFORMATION` 泄露、任一 reviewer failure 永不 PASS；required evidence unavailable、confidence 低于阈值或冲突超过阈值进入 HUMAN_REVIEW。Policy Guard 可以收紧 Judge recommendation，不能放宽 hard gate。

### 7.8 Evidence provider ports 与 ReviewEngine additive fields

```typescript
interface EvidenceQuery {
  caseId: string;
  version: number;
  currentContent: string;
  targetPlatform: string[];
}

interface EvidenceProvider {
  retrieve(input: EvidenceQuery): Promise<EvidenceItem[]>;
}
```

`ReviewContext.dependencies` 保留 required nullable `socialContextProvider`，并新增 optional nullable ports：`brandKnowledgeProvider`、`historicalPrCasesProvider`、`platformPolicyProvider`、`campaignBriefProvider`、`accountProfileProvider`、`productKnowledgeProvider`、`approvedClaimsProvider`、`customerFaqProvider`、`servicePolicyProvider`、`multimodalEvidenceProvider`。这些都是 Algorithm-facing capabilities，不是 SDK/database clients，且不得写入 graph state。

`ReviewEngineInput` additive 新增 `originalContent?: string`，供 Revision Agent 比较原始/当前内容；缺省时使用 `currentContent` 作为本次审核基线，不补查数据库。

`ReviewEngineOutput` additive 新增：

```typescript
interface ReviewEngineOutputV11Extension {
  reviewPlan?: ReviewPlan;
  evidenceCriticResult?: EvidenceCriticResult;
  judgeRecommendation?: JudgeRecommendation;
  finalDecision?: FinalReviewDecision;
}
```

ALG-001-only 实现仍可省略这些字段；ALG-002/ALG-003 multi-agent engine 成功执行必须返回全部字段。任何 `failures` 非空的输出不得包含可发布 PASS 结果。

## 12. SPRINT-004 合同扩展

本节为非破坏性扩展。ALG-001/ALG-002/ALG-003 已冻结的公共 schema 不被重命名或删除；新增 API、Repository、Social Context、Benchmark、RAG 与 Real AI Enablement 合同必须以本节为事实源。

### 12.1 Backend API DTO

#### 12.1.1 通用 Envelope

```ts
type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "METHOD_NOT_ALLOWED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details: Record<string, unknown> | null;
    requestId: string | null;
  };
}

interface PageInfo {
  nextCursor: string | null;
}

interface PaginationQuery {
  limit: number; // 1..100
  cursor: string | null;
}
```

固定 DTO object 使用 strict validation。错误 envelope 不包含 secret、stack trace、完整敏感正文或完整 evidence。

#### 12.1.2 Review API

```ts
interface CreateReviewRequest {
  contentType: ContentType;
  targetPlatform: string[];
  content: string;
  imageUrls: string[];
  sourceUrls: string[];
}

interface ReviewDetailResponse {
  case: ReviewCase;
  latestResult: ReviewEngineOutput | null;
}

interface ReviewListResponse {
  data: ReviewCase[];
  page: PageInfo;
}

interface ReviewActionRequest {
  expectedVersion: number;
  actor: { id: string; displayName: string; role: string };
  reason: string;
}

interface ReviseReviewRequest extends ReviewActionRequest {
  revisedContent: string;
}

interface EscalateReviewRequest extends ReviewActionRequest {
  escalationTarget: string | null;
}

interface ReviewActionResponse {
  case: ReviewCase;
  action: ReviewAction;
}

interface ReviewHistoryResponse {
  case: ReviewCase;
  versions: ContentVersionRecord[];
  actions: ReviewActionRecord[];
  results: StoredReviewResult[];
  evidenceSnapshots: EvidenceSnapshot[];
}

interface EvaluationLatestResponse {
  latestRun: BenchmarkRunSummary | null;
}
```

BE-001 只实现 DTO/handler skeleton；风险判断仍必须通过 `ReviewEngine`。

### 12.2 Repository / Version / Audit 合同

```ts
interface ReviewCaseRecord {
  case: ReviewCase;
  createdAt: string;
  updatedAt: string;
}

interface ContentVersionRecord {
  versionId: string;
  caseId: string;
  version: number;
  content: string;
  imageUrls: string[];
  targetPlatform: string[];
  createdBy: { id: string; displayName: string; role: string };
  createdAt: string;
}

interface StoredReviewResult {
  resultId: string;
  caseId: string;
  version: number;
  executionId: string;
  output: ReviewEngineOutput;
  createdAt: string;
}

interface EvidenceSnapshot {
  snapshotId: string;
  caseId: string;
  version: number;
  executionId: string;
  knowledgeVersion: string | null;
  socialContextVersion: string | null;
  evidenceItems: EvidenceItem[];
  createdAt: string;
}

interface ReviewActionRecord {
  actionId: string;
  caseId: string;
  action: ReviewAction;
  createdAt: string;
}

interface RevisionTransactionInput {
  caseId: string;
  expectedVersion: number;
  revisedContent: string;
  actor: { id: string; displayName: string; role: string };
  reason: string;
  timestamp: string;
}

interface RevisionTransactionResult {
  case: ReviewCase;
  version: ContentVersionRecord;
  action: ReviewActionRecord;
}
```

Repository error code：

```ts
type RepositoryErrorCode =
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "DUPLICATE_RECORD"
  | "TRANSACTION_FAILED"
  | "INVALID_STATE";
```

`ContentVersionRecord` immutable；`ReviewActionRecord` append-only；所有 version mutation 必须使用 `expectedVersion`。Repository 返回调用方可修改的副本，不暴露内部引用。

SPRINT-005 additive：`ReviewCaseRepository` 新增 `updateCase(record: ReviewCaseRecord): Promise<ReviewCaseRecord>`。语义：仅允许更新 `case.currentStage` 与 `case.updatedAt`（orchestration stage 推进）；case 不存在抛 `NOT_FOUND`；不得用于修改 version/currentContent（内容变更只能走 revision transaction）。实现必须继续返回副本。

### 12.3 DATA-002 Social Runtime 合同

DATA-002 runtime 标准平台值：

```ts
type CanonicalSocialPlatform =
  "WEIBO" | "XIAOHONGSHU" | "DOUYIN" | "BILIBILI" | "COOLAPK";

type SocialAccessMode = "local_fixture" | "authorized_export";
```

ALG-001 已冻结过小写平台值。SPRINT-004 采用非破坏性迁移：公共 schema 在迁移期接受历史小写值与 canonical 大写值；DATA-002 normalizer 必须把小写输入映射为 canonical 大写输出。未知平台仍然 fail。

```ts
interface SocialDataAdapter {
  readonly platform: CanonicalSocialPlatform;
  readonly accessMode: SocialAccessMode;
  search(input: SocialSearchInput): Promise<SocialSearchResult>;
}

interface SocialPlatformCoverage {
  platform: CanonicalSocialPlatform;
  status: SocialProviderStatus;
  mentionCount: number;
  sampledPostCount: number;
  sampledCommentCount: number;
  reason: string | null;
}

interface SocialNegativeSignal {
  id: string;
  platform: CanonicalSocialPlatform;
  topic: string;
  reason: string;
  evidenceIds: string[];
  severity: Severity;
}

interface SocialContextSnapshot {
  query: SocialContextQuery;
  platforms: CanonicalSocialPlatform[];
  timeRange: { start: string; end: string };
  mentionCount: number;
  platformCoverage: SocialPlatformCoverage[];
  topTopics: string[];
  emergingRisks: string[];
  representativePosts: SocialPost[];
  representativeComments: SocialComment[];
  negativeSignals: SocialNegativeSignal[];
  providerStatus: SocialProviderStatus;
  generatedAt: string;
}
```

`providerStatus` 为 unavailable/partial 时不得伪装成成功空讨论。unknown engagement 使用 `null`。

### 12.4 TEST-004 Benchmark 合同

```ts
type BenchmarkSplit = "dev" | "test";
type BenchmarkProvenance =
  "synthetic" | "manually_curated" | "authorized_export";

interface BenchmarkCase {
  id: string;
  content: string;
  contentType: ContentType;
  platform: string[];
  expectedDecision: FinalDecision;
  expectedDimensions: ReviewDimension[];
  expectedIssues: IssueCategory[];
  expectedSeverity: Severity;
  requiredEvidence: string[];
  provenance: BenchmarkProvenance;
  notes: string;
  split: BenchmarkSplit;
}

interface BenchmarkManifest {
  datasetVersion: string;
  createdAt: string;
  caseCount: number;
  splitCounts: Record<BenchmarkSplit, number>;
  provenanceCounts: Record<BenchmarkProvenance, number>;
}

interface BenchmarkRunCaseResult {
  caseId: string;
  expectedDecision: FinalDecision;
  actualDecision: FinalDecision;
  expectedDimensions: ReviewDimension[];
  actualDimensions: ReviewDimension[];
  expectedSeverity: Severity;
  actualMaxSeverity: Severity | null;
  requiredEvidence: string[];
  citedEvidence: string[];
  schemaParseSuccess: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number | null;
}

interface BenchmarkMetrics {
  dimensionPrecision: number;
  dimensionRecall: number;
  dimensionF1: number;
  macroF1: number;
  highRiskRecall: number;
  highRiskFalsePassRate: number;
  decisionAccuracy: number;
  manualReviewRate: number;
  evidenceCoverage: number;
  evidenceCitationPrecision: number;
  schemaParseSuccessRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  averageCostPerCase: number | null;
}

interface BenchmarkRunSummary {
  runId: string;
  datasetVersion: string;
  algorithmVersion: string;
  executionMode: ReviewExecutionMode;
  sampleCount: number;
  metrics: BenchmarkMetrics | null;
  createdAt: string;
}
```

Metric 公式以 `domains/test-and-evaluation.md` 与 `TEST-004.md` 为准。TEST-004 Phase A 不调用真实模型。

### 12.5 ALG-004 RAG / Real AI Enablement 合同

```ts
interface KnowledgeDocument {
  documentId: string;
  sourceType:
    "PR" | "BRAND" | "PRODUCT" | "CUSTOMER" | "COMPLIANCE" | "PLATFORM";
  version: string;
  effectiveAt: string;
  title: string;
  content: string;
  tags: string[];
}

interface KnowledgeRetrievalQuery {
  query: string;
  sourceTypes: KnowledgeDocument["sourceType"][];
  topK: number;
}

interface KnowledgeRetrievalResult {
  knowledgeVersion: string;
  documents: Array<{
    document: KnowledgeDocument;
    bm25Score: number;
    vectorScore: number;
    rrfScore: number;
    evidence: EvidenceItem;
  }>;
}

interface KnowledgeRetriever {
  retrieve(input: KnowledgeRetrievalQuery): Promise<KnowledgeRetrievalResult>;
}

type ReviewExecutionMode = "mock" | "hybrid" | "real";
type ReviewModelProvider =
  "mock" | "deepseek" | "qwen" | "openai" | "anthropic";
type ReviewAgentRole =
  "planner" | "specialist" | "critic" | "judge" | "revision";

interface RoleModelSelection {
  provider: ReviewModelProvider;
  model: string | null;
}

interface RoleModelPolicy {
  executionMode: ReviewExecutionMode;
  planner: RoleModelSelection;
  specialist: RoleModelSelection;
  critic: RoleModelSelection;
  judge: RoleModelSelection;
  revision: RoleModelSelection;
}

interface PromptDescriptor {
  promptVersion: string;
  role: ReviewAgentRole;
  inputContract: string;
  outputContract: string;
  evidenceRules: string[];
  forbiddenBehavior: string[];
}

interface LLMAgentTraceMetadata {
  caseId: string;
  version: number;
  executionId: string;
  agentRole: ReviewAgentRole;
  dimension: ReviewDimension | null;
  provider: ReviewModelProvider;
  model: string | null;
  promptVersion: string;
  knowledgeVersion: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}
```

真实 Agent 输出必须通过 Zod structured parse。parse failure、timeout、tool unavailable、missing critical evidence 均不得默认 PASS。Policy Guard 永远 deterministic。

### 12.6 Headless Review Facade

```ts
interface ReviewContentOptions {
  engine?: ReviewEngine;
  context?: ReviewContext;
  executionMode?: ReviewExecutionMode;
}

function reviewContent(
  input: ReviewEngineInput,
  options?: ReviewContentOptions,
): Promise<FinalReviewDecision>;
```

Facade 复用同一个 `ReviewEngine`，不重新实现 Agent、graph、RAG 或 Policy Guard。CLI、Backend、WorkBuddy Adapter 未来可共用该入口。

## 12.7 SPRINT-005 合同扩展（Full-Stack Console）

本节为非破坏性扩展；12.1–12.6 冻结的字段、枚举与语义不变。

### 12.7.1 开发身份与授权（BE-004 MVP）

开发/演示环境通过 HTTP header 传递 actor 身份（`PR_REVIEW_AUTH_MODE=dev-header`）：

```text
x-actor-id: usr_demo_requester
x-actor-name: 演示需求方
x-actor-role: REQUESTER
```

```ts
type ActorRole =
  | "REQUESTER"
  | "ACCOUNT_OPERATOR"
  | "VISUAL_REVIEWER"
  | "COMPLIANCE_REVIEWER"
  | "MEDIA_MANAGER"
  | "SYSTEM_ADMINISTRATOR";
```

- 三个 header 均 trim 后非空；role 必须是 `ActorRole` 之一，否则 `401 UNAUTHORIZED`。
- dev-header 是开发身份提供者，**不是生产安全模型**；生产 OIDC/SSO 适配器属于后续任务，接入前不得宣称具备生产级认证。
- submitter/actor 一律来自该认证上下文。BE-001 冻结的 action DTO 中历史保留的 `actor` 字段仅作 fixture 兼容：服务端解析后**忽略**该字段，始终以 header actor 为准；任何审计、版本与动作记录都使用 header actor。
- Zod schema 校验失败（缺字段、非法枚举、unknown field）映射为 `400 VALIDATION_ERROR`，不得落入 500。

角色×阶段动作矩阵（服务端强制执行，与 allowedActions 一致）：

| Stage                            | 可动作角色（动作）                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| REQUESTER_SELF_CHECK             | 等待算法路由；仅 Requester 本人可 REVISE / WITHDRAW 不在 v1，人工动作不开放          |
| OPERATOR_REVIEW                  | ACCOUNT_OPERATOR（APPROVE/REVISE/REJECT/ESCALATE）                                   |
| VISUAL_REVIEW                    | VISUAL_REVIEWER（APPROVE/REVISE/REJECT/ESCALATE）                                    |
| COMPLIANCE_REVIEW                | COMPLIANCE_REVIEWER（APPROVE/REVISE/REJECT/ESCALATE）                                |
| REVIEW_REQUIRED                  | ACCOUNT_OPERATOR / VISUAL_REVIEWER / COMPLIANCE_REVIEWER / MEDIA_MANAGER（四类动作） |
| RISK_ROUTING                     | 无人工动作（系统路由中）                                                             |
| MEDIA_MANAGER_APPROVAL           | MEDIA_MANAGER（APPROVE/REVISE/REJECT/ESCALATE）；Case 提交者本人不得在本关 APPROVE   |
| SCHEDULING                       | MEDIA_MANAGER（SCHEDULE）                                                            |
| COMPLETED / REJECTED / ESCALATED | 无动作（终态/挂起）                                                                  |

`SYSTEM_ADMINISTRATOR` 默认没有任何内容审批动作。所有越权尝试返回 `403 FORBIDDEN` 且追加审计（actor、动作、reason、拒绝事实）。

### 12.7.2 Detail 响应 additive 字段

```ts
interface ReviewDetailResponse {
  case: ReviewCase;
  latestResult: ReviewEngineOutput | null;
  allowedActions: ReviewActionType[]; // additive；由服务端按 actor/stage/version 计算
}
```

`allowedActions` 为空数组表示当前 actor 在该 stage 无任何可执行动作。Frontend 不得自行推断动作集合。

### 12.7.3 `POST /api/uploads`

请求（JSON，`Content-Type: application/json`）：

```ts
interface UploadFilesRequest {
  files: Array<{
    fileName: string; // trim 后非空，仅用于展示与扩展名参考
    mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    dataBase64: string; // base64 编码文件内容
  }>; // 1..5 个文件
}

interface UploadFilesResponse {
  data: {
    files: Array<{
      url: string; // 以 /uploads/ 开头的相对路径，可直接填入 imageUrls
      fileName: string;
      size: number; // 解码后字节数
      mediaType: string;
    }>;
  };
}
```

限制：单次最多 5 个文件；单文件解码后 ≤ 5 MB（整个请求体上限 32 MB）；对解码后的字节做魔数嗅探，声明 mediaType 与真实类型不符返回 `415 UNSUPPORTED_MEDIA_TYPE`；保存文件名由服务端随机生成（防路径穿越），原始 fileName 仅作展示。`/uploads/*` 为只读静态托管，不提供删除/覆盖。上传目录不是业务事实源；Case 的事实仍是 repository 中的 `imageUrls`。

### 12.7.4 `POST /api/reviews/:id/schedule` 与 PublishReceipt

```ts
interface ScheduleReviewRequest {
  expectedVersion: number;
  reason: string; // trim 后非空
}

interface PublishReceipt {
  receiptId: string;
  caseId: string;
  version: number;
  scheduledAt: string; // ISO-8601 UTC
  mode: "mock";
  note: string;
}

interface ScheduleReviewResponse {
  data: {
    case: ReviewCase;
    action: ReviewAction; // action = "SCHEDULE"
    receipt: PublishReceipt;
  };
}
```

守卫：仅 `MEDIA_MANAGER`、stage=`SCHEDULING`、expectedVersion 匹配；`Idempotency-Key` 相同只排期一次；成功后 stage 推进 `COMPLETED` 并 append-only 写 SCHEDULE action。MVP 只绑定 `MockPublisher`；真实 publisher 需要独立任务与显式生产开关，本轮不存在任何真实发布路径。

### 12.7.5 Error code additive

`ApiErrorCode` 增加：`"UNAUTHORIZED"`（401）、`"FORBIDDEN"`（403）、`"INVALID_STAGE_ACTION"`（422）。HTTP 状态码与第 3 节既有约定一致；错误 envelope 形状不变。

### 12.7.6 Stage 转移表（orchestration MVP）

**创建后自动路由**（engine 运行完毕，`finalDecision` 决定落点；failures 非空强制 `REVIEW_REQUIRED`）：

| 条件                                      | 落点 stage                                                           |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `failures` 非空（fail closed）            | `REVIEW_REQUIRED`                                                    |
| `finalDecision.decision = "PASS"`         | `SCHEDULING`（AI 通过，待 MEDIA_MANAGER 模拟排期；发布仍需人工动作） |
| `finalDecision.decision = "REVISE"`       | `REVIEW_REQUIRED`（附 revision proposal）                            |
| `finalDecision.decision = "HUMAN_REVIEW"` | `REVIEW_REQUIRED`                                                    |
| `finalDecision.decision = "BLOCK"`        | `REJECTED`                                                           |
| 无 finalDecision 的其他失败               | `REVIEW_REQUIRED`                                                    |

**人工 APPROVE 推进**：

```text
REVIEW_REQUIRED -> OPERATOR_REVIEW
OPERATOR_REVIEW -> 含图片素材则 VISUAL_REVIEW，否则 COMPLIANCE_REVIEW
VISUAL_REVIEW -> COMPLIANCE_REVIEW
COMPLIANCE_REVIEW -> MEDIA_MANAGER_APPROVAL（RISK_ROUTING 在 MVP 合并进本步，路由事实记 AUTO_ROUTE action）
MEDIA_MANAGER_APPROVAL -> SCHEDULING
```

**其他动作**：REJECT：任意审核 stage -> `REJECTED`；ESCALATE：任意审核 stage -> `ESCALATED`；REVISE：任意审核 stage -> 新 version，stage 回到 `REQUESTER_SELF_CHECK` 并立即对新版本重新运行 engine（再走「创建后自动路由」）；SCHEDULE：`SCHEDULING -> COMPLETED`。

**MVP 确定性推进**：本轮人工动作一律按上表在 Backend 确定性推进，不调用 `engine.resume(...)`；MemorySaver 是进程内执行状态，resume/durable checkpoint 恢复属于后续 BE-003 完整版任务。REVISE 后的重审使用新的 `engine.review(...)`（新 execution）。每条路径都必须：校验 actor/stage/expectedVersion、append-only 写 ReviewAction、保持 fail closed（engine 异常 -> `REVIEW_REQUIRED`，绝不产生 APPROVE）。
