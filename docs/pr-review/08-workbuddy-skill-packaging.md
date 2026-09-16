# WorkBuddy Skill Packaging 边界

状态：PRODUCT-001 设计基线；本阶段不实现 WorkBuddy package。

## 1. 目标

审核核心保持 headless，使 Web Frontend、Backend API、CLI 与未来 WorkBuddy Skill 共同调用同一个 `ReviewEngine`，避免在各入口复制 Planner、Specialist、Critic、Judge、Policy Guard 或 Revision 逻辑。

## 2. 稳定核心入口

未来 facade 冻结为：

```typescript
reviewContent(input: ReviewEngineInput): Promise<FinalReviewDecision>
```

实际 composition root 仍需注入 typed runtime context、policy、checkpoint 与 evidence ports。Facade 不允许调用方传 Secret、provider SDK client、HTTP Request/Response 或 database client。

```text
Web Frontend -> Backend API --+
CLI --------------------------+-> ReviewEngine -> Multi-Agent Graph
WorkBuddy Skill Adapter ------+
```

Frontend 仍只调用 Backend API；图中的直接关系表达共享业务核心，不授权浏览器 import 服务端 Algorithm。

## 3. Future CLI

目标命令：

```text
yarn pr-review:review --input xxx.json --json
```

CLI Adapter 只负责读取/验证 JSON、构建允许的 context、调用核心并输出 schema-valid `FinalReviewDecision`。默认禁止真实发布，错误返回 typed failure 且退出非零；不得把 API key 或完整私有正文写入日志。

## 4. WorkBuddy Skill Adapter

- 当前不绑定任何尚未确认的 WorkBuddy package/manifest schema。
- Skill 只负责输入映射、权限边界、调用 ReviewEngine 和格式化结果，不重新实现审核决策。
- Skill 输出必须保留五维结果、evidence coverage、blocking issues、revision direction 与 trace correlation reference。
- Skill 不持有 provider credential，不绕过 Backend 权限/版本机制，不直接调用 Publisher。
- package schema、安装方式、权限声明和 UI 呈现需在独立任务确认后再冻结。

## 5. 隐私与可观测性

默认 trace metadata 只包含脱敏 correlation ID、case/version、算法/policy/schema 版本。`TRACE_CONTENT_ENABLED=false` 时不记录正文、PII、证据原文或 Secret。WorkBuddy Adapter 不能扩大 Algorithm 已定义的数据收集范围。

## 6. 本轮范围

PRODUCT-001 仅完成架构与接口边界；不创建 CLI 脚本、不创建 WorkBuddy package、不接入真实 LLM/RAG/Social/OCR/VLM，不实现 Backend 或 Frontend。

## 7. SPRINT-004 Headless Facade

SPRINT-004 允许在 ALG-004 阶段实现最小 `reviewContent(...)` facade。该 facade 只调用同一个 `ReviewEngine` / Algorithm composition，不复制 Planner、Specialist、Critic、Judge、Policy Guard 或 Revision 逻辑。

本 Sprint 仍不实现最终 WorkBuddy package，不绑定任何尚未确认的 package schema。未来 WorkBuddy Skill、CLI 与 Backend API 都应复用同一个 headless 核心入口，并由各自 Adapter 负责输入映射、权限、日志与输出格式。
