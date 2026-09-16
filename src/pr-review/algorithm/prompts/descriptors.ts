import {
  PromptDescriptorSchema,
  type PromptDescriptor,
} from "../llm/schemas.js";

export const plannerPromptDescriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "planner-v1",
    role: "planner",
    inputContract: "ReviewEngineInput",
    outputContract: "ReviewPlan",
    evidenceRules: ["五个维度至少 LIGHT", "证据不足时标记 requiredEvidence"],
    forbiddenBehavior: ["不得跳过 COMPLIANCE_SAFETY", "不得编造证据"],
  });

export const specialistPromptDescriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "specialist-v1",
    role: "specialist",
    inputContract: "DimensionReviewInput",
    outputContract: "DimensionReviewResult",
    evidenceRules: ["引用 evidenceIds", "证据不足时输出 missingEvidence"],
    forbiddenBehavior: ["不得把社媒讨论当作事实唯一依据", "不得无依据声称违法"],
  });

export const criticPromptDescriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "critic-v1",
    role: "critic",
    inputContract: "DimensionReviewResult[] + Evidence",
    outputContract: "EvidenceCriticResult",
    evidenceRules: ["检查 issue/evidence 匹配", "标记跨维冲突"],
    forbiddenBehavior: ["不重新执行五维完整审核", "不得消除缺失证据"],
  });

export const judgePromptDescriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "judge-v1",
    role: "judge",
    inputContract: "DimensionReviewResults + Critic",
    outputContract: "JudgeRecommendation",
    evidenceRules: ["总结 top risks", "说明 revision priority"],
    forbiddenBehavior: ["不得绕过 Policy Guard", "不得默认 PASS"],
  });

export const revisionPromptDescriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "revision-v1",
    role: "revision",
    inputContract: "Content + BlockingIssues + Evidence",
    outputContract: "RevisionProposal",
    evidenceRules: ["说明原文问题、原因、修改方向", "可选 suggestedContent"],
    forbiddenBehavior: ["不得悄悄覆盖 currentContent", "不得扩大事实结论"],
  });

// ---------- SPRINT-006 v2（hybrid 运行时默认） ----------

export const plannerPromptV2Descriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "planner-v2",
    role: "planner",
    inputContract: "ReviewEngineInput + hasImages",
    outputContract: "ReviewPlan",
    evidenceRules: ["五维全量", "按内容信号升级 FULL", "有图必须要求 MULTIMODAL_EVIDENCE"],
    forbiddenBehavior: ["不得跳过 COMPLIANCE_SAFETY", "不得编造证据来源"],
  });

export const specialistPromptV2Descriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "specialist-v2",
    role: "specialist",
    inputContract: "Dimension + Content + ImageEvidence + Evidence + Depth",
    outputContract: "DimensionReviewResult",
    evidenceRules: [
      "reason 必须是针对分数的具体论证并引用原文片段",
      "issues 涉及原文时必须给出 textSpan offset",
      "证据不足写 missingEvidence 并降低 confidence",
    ],
    forbiddenBehavior: [
      "不得输出模板化审核话术",
      "不得无依据声称违法违规",
      "不得把社媒讨论当作事实唯一依据",
    ],
  });

export const criticPromptV2Descriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "critic-v2",
    role: "critic",
    inputContract: "DimensionReviewResult[] + EvidenceCoverage",
    outputContract: "EvidenceCriticResult",
    evidenceRules: ["逐条核对 issue/evidence 一致性", "点名具体 issue 或维度"],
    forbiddenBehavior: ["不重新执行五维审核", "不得改写 unsupported 结论"],
  });

export const judgePromptV2Descriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "judge-v2",
    role: "judge",
    inputContract: "DimensionReviewResult[] + Critic + weights",
    outputContract: "JudgeRecommendation",
    evidenceRules: [
      "judgeReason 必须论证 overallRiskScore 构成",
      "证据缺失/冲突时必须下调 confidence",
    ],
    forbiddenBehavior: ["不得在 failure/证据缺失时建议 PASS", "不得稀释 hard gate 问题"],
  });

export const revisionPromptV2Descriptor: PromptDescriptor =
  PromptDescriptorSchema.parse({
    promptVersion: "revision-v2",
    role: "revision",
    inputContract: "Content + BlockingIssues + Judge + Evidence",
    outputContract: "RevisionProposal",
    evidenceRules: ["逐条说明改动点与原因", "先合规后事实再措辞"],
    forbiddenBehavior: ["不得新增未证实事实", "不得改变关键信息"],
  });
