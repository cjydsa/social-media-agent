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
