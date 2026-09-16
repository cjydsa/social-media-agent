# PR Review 模型评测

本目录用于 PR Review 的 AI 质量评估资产，包括 benchmark dataset、baseline runner、metrics、实验配置与错误分析。它不能替代 `tests/pr-review/` 的软件测试。

## TEST-004 Phase A 范围

SPRINT-004 的 TEST-004 Phase A 只实现：

- Public Content Review Benchmark v1 dataset schema。
- dataset manifest。
- loader。
- metrics。
- baseline runner interface。
- `yarn pr-review:eval:validate`。

本阶段不调用真实 DeepSeek/Qwen，不运行真实模型 benchmark，不调优 prompt，不输出模型质量结论。

## 数据真实性

每条 case 必须标明 provenance：

- `synthetic`
- `manually_curated`
- `authorized_export`

`synthetic` 不得被描述为真实平台采集或人工标注 ground truth。`authorized_export` 必须来自明确授权且完成必要脱敏的数据源。

## Split 规则

- `dev`：允许用于开发、prompt 迭代与错误分析。
- `test`：不得在反复查看结果后修改 prompt 或标签。

Validate command 必须检查 duplicate case IDs、split leakage、label completeness、provenance 与 manifest case count。

## 指标

指标事实源为 `docs/pr-review/change-log/TEST-004.md` 与 `docs/pr-review/domains/test-and-evaluation.md`。不得硬编码预期分数或伪造 baseline 结果。
