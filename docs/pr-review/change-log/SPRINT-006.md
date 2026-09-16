# SPRINT-006 Change Log

## Metadata

- Task: SPRINT-006 — LLM 打分理由、多模态深度分析与 Prompt 工程（接线上化 hybrid 审核）
- Owner: WorkBuddy
- Created: 2026-09-16
- Status: Done (2026-09-16)

## Pre-Implementation Design

### 1. Background

SPRINT-005 交付的控制台运行的是确定性（mock）审核引擎：五维分数来自预置 scenario profile，分数理由为模板文案，图片不参与实质分析。用户明确要求：**每个维度的打分必须由 AI 给出具体理由（为什么是这个分数）、对文案做深度分析、含图内容必须真实做多模态识别、prompt 高质量**。

ALG-004 已交付但未接线的资产：`llm/llm-agents.ts`（planner/specialist/critic/judge/revision 的 LLM wrapper）、`llm/structured-output.ts`（带重试的 structured parse）、Role Model Policy 配置（`PR_REVIEW_EXECUTION_MODE` + 五 role provider/model）、`prompts/*/v1.md`（骨架 prompt）。本任务把它们**正式接进 LangGraph 运行时**，并保持：mock 模式与全部既有测试行为不变、Policy Guard 永远确定性、失败 fail closed。

### 2. Current behavior

- `buildReviewGraph` 五个 specialist 节点只调用 `runSpecialist`（确定性 profile）；planner/critic/judge/revision 同样确定性。
- `scenarioResolver` 用 `[scenario:x]` 标记决定 profile；无标记即 `normal`（全 PASS）。
- 图片只作为 URL 记录，无任何视觉分析；plan 只在有图时把 `MULTIMODAL_EVIDENCE` 列为 requiredEvidence，而 evidenceToolset 无法提供 → 必现 missing → HUMAN_REVIEW。
- `createReviewModel` 只被 smoke 脚本使用。

### 3. Expected behavior

- `PR_REVIEW_EXECUTION_MODE=mock`（默认）：行为与 SPRINT-005 完全一致，所有既有测试不动。
- `hybrid`：planner / 五个 specialist / critic / judge / revision 由真实 LLM structured output 驱动：
  - 每个维度输出 `riskScore`、`confidence`、`verdict`，且 `reason` 必须是**针对该分数的具体中文论证**（引用原文片段与证据，说明加分/减分依据）；
  - `issues[].textSpan` 必须给出原文 offset（前端高亮可用）；
  - prompt 为每个角色单独编写的版本化中文 prompt（见第 6 节），含打分锚点（0–20/21–40/41–60/61–80/81–100 的语义）、证据纪律与禁止行为。
- 含图内容：当 `PR_REVIEW_VISION_PROVIDER=qwen` 且配置完整时，先由视觉模型（默认 `qwen-vl-plus`，base64 内联上传本地图片）产出 OCR 文字、画面要素与视觉风险观察，作为 `MULTIMODAL_EVIDENCE` EvidenceItems 注入证据池供 specialist 引用；视觉分析失败/未配置 → `MULTIMODAL_EVIDENCE` 记 missing → Policy Guard 强制 HUMAN_REVIEW（fail closed，不假装看过图）。
- LLM 调用失败/parse 失败：该 agent 记 `failures` + `createFailureResult`，最终由 Policy Guard 强制人工，绝不默认通过。
- mock/hybrid 切换只发生在 composition root（server）；Algorithm 不读 env。

### 4. Affected files / interfaces / tasks

- `docs/pr-review/change-log/SPRINT-006.md`（本文件）
- `docs/pr-review/domains/algorithm.md`（hybrid 运行时设计）
- `docs/pr-review/03-contracts.md`（additive：12.8 hybrid runtime 与 vision evidence 合同）
- `docs/pr-review/06-environment-and-api-config.md`（`PR_REVIEW_VISION_PROVIDER`/`PR_REVIEW_VISION_MODEL`）
- `docs/pr-review/domains/test-and-evaluation.md`（SPRINT-006 测试矩阵）
- `docs/pr-review/05-project-board.md`（SPRINT-006 IN PROGRESS）
- 代码：`algorithm/llm/runtime-agents.ts`（新）、`algorithm/llm/visual-analysis.ts`（新）、`algorithm/graph/build-review-graph.ts`（可选 agents 注入）、`algorithm/engine/langgraph-review-engine.ts`（透传）、`algorithm/prompts/**`（v2 prompt）、`server/server.ts`（hybrid 组装）、`algorithm/prompts/index.ts`（descriptor 注册）。

### 5. Error handling / state transitions / concurrency

- graph 节点签名不变；LLM agent 抛错与确定性 agent 抛错走同一条 `failures` 通道。
- `StructuredAgentError` 已带 ReviewFailure；节点 catch 后写 `failures` 并产出 `createFailureResult`。
- Policy Guard 输入不变：dimensionResults + critic + judge + coverage + failures → FinalReviewDecision；LLM 不改变 hard gate、publishable 与 LOW-auto 门槛。
- 无并发/迁移影响；hybrid 只增加 LLM 延迟（specialist 并行，预算 ≤ 60s）。

### 6. Test plan

- `tests/pr-review/unit/hybrid-graph.test.ts`：用 mock StructuredOutputModel 注入合法/非法输出，验证 hybrid 路径分数与理由落库、LLM 失败 fail closed、mock 模式不调用 LLM。
- `tests/pr-review/unit/visual-analysis.test.ts`：mock VLM 响应 → EvidenceItem 形状与 missing 路径。
- 既有 192+37 测试零改动通过。
- 真实模型仅手动 smoke 与演示（不计入单测）。

### 7. Acceptance

- hybrid 模式下一次真实提交返回五维 LLM 评分，每维 `reason` 为具体打分论证（非模板）。
- 含图提交产生 `MULTIMODAL_EVIDENCE` 证据项（OCR/视觉观察）；关掉 vision 配置则该证据 missing 且强制人工。
- prompt 文件版本化（v2），descriptor 注册到 trace metadata。
- `tsc --noEmit`、全部单测、Prettier、docs gate 通过。

### 8. Non-goals

- 不改变五维划分、stage 转移表、Policy Guard 规则、API 合同（additive 除外）。
- 不接 Kimi/OpenAI/Anthropic 新 provider；不做 benchmark 重跑；不做生产 OIDC。

## Design changes

（实现过程中如有设计变化追加于此，不覆盖原设计。）

1. `VISUAL_REVIEW_ENABLED` + `VISUAL_PROVIDER` 改为 `PR_REVIEW_VISION_PROVIDER` + `PR_REVIEW_VISION_MODEL`，vision 配置归入 PR Review 专用命名空间；原 `visualAnalysis` 字段保留向后兼容。
2. `buildVisionLLMConfig()` 从 config/providers.ts 导出，server.ts composition root 直接调用；与 LLM provider 解耦，支持独立 qwen VL 配置。
3. jest.config.js 移除废弃的 `isolatedModules: true`（已迁移到 tsconfig.json），消除 ts-jest v30 兼容性警告。
4. multimodal evidence 收集：`VisualEvidenceToolset` 包装 `DeterministicEvidenceToolset`，`collect()` 在 plan 声明需要 MULTIMODAL_EVIDENCE 且 vision 不可用时直接返回 missing（不抛错），Policy Guard 据此路由 HUMAN_REVIEW。

## Implementation Result

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/pr-review/algorithm/llm/runtime-agents.ts` | `createRuntimeAgents()` 工厂，按 executionMode 选择注入 agent set；mock 时返回 null |
| `src/pr-review/algorithm/llm/visual-analysis.ts` | `QwenVisualAnalyzer` 类，支持单图/多图 batch 分析，base64 内联上传，HTTP 错误映射，schema 验证 |
| `src/pr-review/algorithm/prompts/planner/planner-v2.md` | Planner v2 prompt：含 few-shot 示例（no-risk / pr-risk / operations-risk）|
| `src/pr-review/algorithm/prompts/specialist/specialist-v2.md` | Specialist v2 prompt：含打分锚点（0-20/21-40/41-60/61-80/81-100）、few-shot、cross-dimension conflict 自检、fact-evidence alignment |
| `src/pr-review/algorithm/prompts/critic/critic-v2.md` | Critic v2 prompt：含 checklist 验证流程、four-check-item 证据校验、few-shot |
| `src/pr-review/algorithm/prompts/judge/judge-v2.md` | Judge v2 prompt：含决策阈值（16/32/64/96）、few-shot（PASS vs BLOCK 场景）、judgeReason 维度分数引用规则 |
| `src/pr-review/algorithm/prompts/revision/revision-v2.md` | Revision v2 prompt：含修改方向建议、风险缓解优先原则 |
| `src/pr-review/algorithm/prompts/vision/` | 视觉分析系统 prompt 目录 |
| `tests/pr-review/algorithm/hybrid-graph.test.ts` | 11 个测试：LLM agent 路由、dimension drift 保护、失败处理、planner 降级、mock 模式验证、跨维度冲突检测、vision evidence 收集/缺失/多模态路由 |
| `tests/pr-review/algorithm/visual-analysis.test.ts` | 8 个测试：合法响应解析、base64 内联、bad config 报错、不支持的图片格式、HTTP 500、非 JSON 拒绝、schema 验证失败、多图 batch 分析 |

### 修改文件

| 文件 | 变更说明 |
|------|---------|
| `src/pr-review/algorithm/graph/build-review-graph.ts` | `graphOptions.agents` 可选注入；`evidence_planning` 节点透传 `state.input` 给 evidence toolset |
| `src/pr-review/algorithm/evidence/evidence-tools.ts` | 新增 `VisualEvidenceToolset` 包装类，`collect()` 方法解析 MULTIMODAL_EVIDENCE |
| `src/pr-review/algorithm/llm/index.ts` | 导出 `createRuntimeAgents`、`QwenVisualAnalyzer`、`VisualAnalysisResult` |
| `src/pr-review/algorithm/prompts/descriptors.ts` | 注册 v2 prompt descriptors，trace metadata 携带 prompt 版本 |
| `src/pr-review/config/types.ts` | 新增 `VisionConfig`（provider/model）、`PR_REVIEW_VISION_PROVIDER/MODEL` 环境变量 |
| `src/pr-review/config/providers.ts` | 新增 `buildVisionLLMConfig()` 函数 |
| `src/pr-review/server/server.ts` | 新增 `buildEngineOptions()` 组装函数，hybrid 模式下构建 LLM agents 并包装 vision evidence toolset |
| `src/pr-review/config/env.ts` | schema 新增 `PR_REVIEW_VISION_PROVIDER`、`PR_REVIEW_VISION_MODEL` 字段 |
| `src/pr-review/backend/auth/dev-header.ts` | 更新 actor display name 编码处理 |
| `tsconfig.json` | 新增 `isolatedModules: true` + `rootDir: "."`（修复 ts-jest TS151002/TS5011）|
| `jest.config.js` | 移除废弃 `isolatedModules: true`（已迁移到 tsconfig.json）|
| `docs/pr-review/03-contracts.md` | 新增 12.8 hybrid runtime 与 vision evidence 合同 |
| `docs/pr-review/06-environment-and-api-config.md` | 新增 PR_REVIEW_VISION_PROVIDER/MODEL 文档 |
| `docs/pr-review/domains/algorithm.md` | 新增 hybrid 运行时设计章节 |
| `docs/pr-review/domains/test-and-evaluation.md` | 新增 SPRINT-006 测试矩阵 |
| `apps/pr-review-console/src/pages/ReviewDetail.tsx` | 前端展示 LLM reason 字段 |

## Validation Evidence

### TypeScript 编译

```
$ npx tsc --noEmit
（无输出，exit code 0）
```

### Jest 测试结果

```
Test Suites: 27 passed, 27 total
Tests:       213 passed, 213 total
Snapshots:   0 total
Time:        4.403 s
Ran all test suites matching pr-review.
```

**新增测试覆盖（SPRINT-006）**：
- `hybrid-graph.test.ts`：11 tests — LLM agent 路由、dimension drift 保护、LLM 失败 fail closed、deterministic planner 降级、mock 模式不调用 LLM、跨维度冲突检测、vision evidence 收集/缺失/路由
- `visual-analysis.test.ts`：8 tests — 合法响应解析、base64 内联、bad config 报错、不支持的图片格式、HTTP 500 映射、非 JSON 拒绝、schema 验证失败、多图 batch 分析

**既有测试**：202 tests 全部通过，零回归。

### Prompt 质量提升

- 每个 v2 prompt 含**打分锚点**：0-20（低风险）、21-40（低风险）、41-60（中等风险）、61-80（高风险）、81-100（极高风险）的语义描述
- **few-shot 示例**：每个角色至少 2 个示例，覆盖 PASS/REVISE/BLOCK 场景
- **cross-dimension conflict 自检**：specialist 在评分前检查其他维度是否给出矛盾结论
- **fact-evidence alignment**：要求 specialist 必须引用原文片段（带 offset）支撑打分理由
- **judgeReason 维度分数引用**：要求 judge 必须引用具体维度分数和置信度作为决策依据
