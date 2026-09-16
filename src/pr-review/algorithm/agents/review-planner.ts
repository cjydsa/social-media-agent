import {
  REVIEW_DIMENSIONS,
  ReviewPlanSchema,
  type ReviewDimension,
  type ReviewEvidenceSource,
  type ReviewPlan,
} from "../schemas/multi-agent.js";
import type { ReviewEngineInput } from "../schemas/review-engine.js";
import type { ReviewScenario } from "./types.js";

const focusByScenario: Partial<Record<ReviewScenario, ReviewDimension[]>> = {
  "pr-risk": ["PUBLIC_RELATIONS"],
  "operations-risk": ["OPERATIONS"],
  "product-risk": ["PRODUCT"],
  "customer-risk": ["CUSTOMER"],
  "compliance-risk": ["COMPLIANCE_SAFETY"],
  "multi-risk": [
    "PUBLIC_RELATIONS",
    "PRODUCT",
    "CUSTOMER",
    "COMPLIANCE_SAFETY",
  ],
  "missing-evidence": ["PRODUCT"],
  "reviewer-conflict": ["PUBLIC_RELATIONS", "PRODUCT"],
  "reviewer-failure": ["PRODUCT"],
};

const evidenceByScenario: Partial<
  Record<ReviewScenario, ReviewEvidenceSource[]>
> = {
  "pr-risk": ["SOCIAL_CONTEXT", "BRAND_KNOWLEDGE"],
  "operations-risk": ["PLATFORM_POLICY"],
  "product-risk": ["PRODUCT_KNOWLEDGE", "APPROVED_CLAIMS"],
  "customer-risk": ["CUSTOMER_FAQ", "SERVICE_POLICY"],
  "compliance-risk": ["PLATFORM_POLICY"],
  "multi-risk": [
    "SOCIAL_CONTEXT",
    "PRODUCT_KNOWLEDGE",
    "CUSTOMER_FAQ",
    "PLATFORM_POLICY",
  ],
  "missing-evidence": ["PRODUCT_KNOWLEDGE"],
  "reviewer-conflict": ["SOCIAL_CONTEXT", "PRODUCT_KNOWLEDGE"],
  "reviewer-failure": ["PRODUCT_KNOWLEDGE"],
};

export function createReviewPlan(
  input: ReviewEngineInput,
  scenario: ReviewScenario,
): ReviewPlan {
  const focused = new Set(focusByScenario[scenario] ?? []);
  const requiredEvidenceSources = [
    ...(evidenceByScenario[scenario] ?? []),
    ...(input.imageUrls.length > 0 ? (["MULTIMODAL_EVIDENCE"] as const) : []),
  ];

  return ReviewPlanSchema.parse({
    requiredDimensions: [...REVIEW_DIMENSIONS],
    reviewDepthByDimension: Object.fromEntries(
      REVIEW_DIMENSIONS.map((dimension) => [
        dimension,
        focused.has(dimension) ? "FULL" : "LIGHT",
      ]),
    ),
    requiredEvidenceSources: [...new Set(requiredEvidenceSources)],
    requiresSocialContext: requiredEvidenceSources.includes("SOCIAL_CONTEXT"),
    requiresProductKnowledge:
      requiredEvidenceSources.includes("PRODUCT_KNOWLEDGE"),
    requiresPlatformPolicy: requiredEvidenceSources.includes("PLATFORM_POLICY"),
    requiresVisualAnalysis: input.imageUrls.length > 0,
    planningReason:
      focused.size === 0
        ? "公网内容执行五维 LIGHT 基线审核。"
        : `根据内容场景将 ${[...focused].join(", ")} 升级为 FULL 审核。`,
  });
}
