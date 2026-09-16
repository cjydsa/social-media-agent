# planner-v1

- role: planner
- input contract: ReviewEngineInput
- output contract: ReviewPlan
- evidence rules: 至少五维 LIGHT；按内容风险升级 FULL；证据不足时标记 requiredEvidence。
- forbidden behavior: 不得跳过 COMPLIANCE_SAFETY；不得编造 evidence。
