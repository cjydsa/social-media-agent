import {
  DimensionReviewResultSchema,
  type DimensionReviewResult,
  type ReviewDimension,
  type ReviewEvidenceSource,
} from "../schemas/multi-agent.js";
import type { IssueCategory, Severity } from "../schemas/common.js";
import type { ReviewScenario } from "./types.js";
import { evidenceIdFor } from "../evidence/evidence-tools.js";

interface RiskProfile {
  riskScore: number;
  confidence: number;
  category: IssueCategory;
  severity: Severity;
  reason: string;
  suggestedChange: string;
  evidenceSource?: ReviewEvidenceSource;
}

const profileByScenario: Partial<
  Record<ReviewScenario, Partial<Record<ReviewDimension, RiskProfile>>>
> = {
  "pr-risk": {
    PUBLIC_RELATIONS: {
      riskScore: 75,
      confidence: 0.9,
      category: "CONTEXTUAL_MISINTERPRETATION",
      severity: "HIGH",
      reason: "表述容易被断章取义并升级舆情。",
      suggestedChange: "补充上下文并降低对立性表达。",
      evidenceSource: "SOCIAL_CONTEXT",
    },
  },
  "operations-risk": {
    OPERATIONS: {
      riskScore: 45,
      confidence: 0.9,
      category: "PLATFORM_RULE",
      severity: "MEDIUM",
      reason: "当前表达与目标平台规则不完全匹配。",
      suggestedChange: "按平台规则调整 CTA 与发布格式。",
      evidenceSource: "PLATFORM_POLICY",
    },
  },
  "product-risk": {
    PRODUCT: {
      riskScore: 70,
      confidence: 0.92,
      category: "UNSUPPORTED_PRODUCT_CLAIM",
      severity: "HIGH",
      reason: "产品能力声明缺少批准依据。",
      suggestedChange: "删除无依据声明或补充可追溯批准证据。",
      evidenceSource: "APPROVED_CLAIMS",
    },
  },
  "customer-risk": {
    CUSTOMER: {
      riskScore: 45,
      confidence: 0.88,
      category: "CUSTOMER_EXPECTATION",
      severity: "MEDIUM",
      reason: "表述可能形成超出服务政策的用户预期。",
      suggestedChange: "明确适用条件并避免无边界承诺。",
      evidenceSource: "SERVICE_POLICY",
    },
  },
  "compliance-risk": {
    COMPLIANCE_SAFETY: {
      riskScore: 90,
      confidence: 0.96,
      category: "PRIVACY",
      severity: "CRITICAL",
      reason: "内容包含隐私泄露风险。",
      suggestedChange: "移除个人信息并由合规负责人复核。",
      evidenceSource: "PLATFORM_POLICY",
    },
  },
  "missing-evidence": {
    PRODUCT: {
      riskScore: 20,
      confidence: 0.45,
      category: "UNSUPPORTED_PRODUCT_CLAIM",
      severity: "MEDIUM",
      reason: "必需产品证据不可用，无法完成判断。",
      suggestedChange: "补充批准声明或产品知识证据后重新审核。",
      evidenceSource: "PRODUCT_KNOWLEDGE",
    },
  },
  "reviewer-conflict": {
    PUBLIC_RELATIONS: {
      riskScore: 80,
      confidence: 0.82,
      category: "PUBLIC_SENTIMENT",
      severity: "HIGH",
      reason: "公关语境显示较高传播风险。",
      suggestedChange: "人工核对近期舆情与发布语境。",
      evidenceSource: "SOCIAL_CONTEXT",
    },
    PRODUCT: {
      riskScore: 10,
      confidence: 0.82,
      category: "FACT",
      severity: "LOW",
      reason: "产品证据未显示明显事实问题。",
      suggestedChange: "保留产品依据引用。",
      evidenceSource: "PRODUCT_KNOWLEDGE",
    },
  },
  "multi-risk": {
    PUBLIC_RELATIONS: {
      riskScore: 55,
      confidence: 0.87,
      category: "CRISIS_RESPONSE",
      severity: "MEDIUM",
      reason: "危机回应语气可能升级争议。",
      suggestedChange: "使用承担责任且可验证的中性表述。",
      evidenceSource: "SOCIAL_CONTEXT",
    },
    PRODUCT: {
      riskScore: 65,
      confidence: 0.88,
      category: "PERFORMANCE_CLAIM",
      severity: "HIGH",
      reason: "性能声明依据不足。",
      suggestedChange: "限定性能声明的条件与来源。",
      evidenceSource: "PRODUCT_KNOWLEDGE",
    },
    CUSTOMER: {
      riskScore: 50,
      confidence: 0.85,
      category: "SERVICE_COMMITMENT",
      severity: "MEDIUM",
      reason: "服务承诺边界不清。",
      suggestedChange: "明确服务范围与例外。",
      evidenceSource: "CUSTOMER_FAQ",
    },
    COMPLIANCE_SAFETY: {
      riskScore: 60,
      confidence: 0.9,
      category: "MISLEADING_CLAIM",
      severity: "HIGH",
      reason: "声明存在误导性合规风险。",
      suggestedChange: "删除绝对结论并补充限定条件。",
      evidenceSource: "PLATFORM_POLICY",
    },
  },
};

export function runSpecialist(
  dimension: ReviewDimension,
  scenario: ReviewScenario,
  availableEvidenceIds: ReadonlySet<string>,
): DimensionReviewResult {
  if (scenario === "reviewer-failure" && dimension === "PRODUCT") {
    throw new Error("Injected deterministic product reviewer failure.");
  }

  const profile = profileByScenario[scenario]?.[dimension];
  if (!profile) {
    return DimensionReviewResultSchema.parse({
      dimension,
      riskScore: 5,
      confidence: 0.9,
      verdict: "PASS",
      reason: "LIGHT 审核未发现当前维度的实质风险。",
      issues: [],
      evidenceIds: [],
      missingEvidence: [],
      suggestedChanges: [],
    });
  }

  const expectedEvidenceId = profile.evidenceSource
    ? evidenceIdFor(profile.evidenceSource)
    : null;
  const hasEvidence =
    expectedEvidenceId === null || availableEvidenceIds.has(expectedEvidenceId);
  const issueId = `issue-${scenario}-${dimension.toLowerCase()}`;

  return DimensionReviewResultSchema.parse({
    dimension,
    riskScore: profile.riskScore,
    confidence: hasEvidence
      ? profile.confidence
      : Math.min(profile.confidence, 0.45),
    verdict: hasEvidence
      ? profile.severity === "CRITICAL"
        ? "BLOCK"
        : profile.severity === "HIGH"
          ? "WARN"
          : "WARN"
      : "REVIEW_REQUIRED",
    reason: profile.reason,
    issues: [
      {
        id: issueId,
        category: profile.category,
        severity: profile.severity,
        textSpan: null,
        reason: profile.reason,
        evidenceIds:
          hasEvidence && expectedEvidenceId ? [expectedEvidenceId] : [],
        suggestion: profile.suggestedChange,
      },
    ],
    evidenceIds: hasEvidence && expectedEvidenceId ? [expectedEvidenceId] : [],
    missingEvidence:
      !hasEvidence && profile.evidenceSource ? [profile.evidenceSource] : [],
    suggestedChanges: [profile.suggestedChange],
  });
}

export function createFailureResult(
  dimension: ReviewDimension,
): DimensionReviewResult {
  return DimensionReviewResultSchema.parse({
    dimension,
    riskScore: 50,
    confidence: 0,
    verdict: "REVIEW_REQUIRED",
    reason: "Specialist 执行失败，必须人工审核。",
    issues: [],
    evidenceIds: [],
    missingEvidence: [],
    suggestedChanges: ["人工复核该维度并补充审核结论。"],
  });
}
