import { z } from "zod";
import {
  IssueCategorySchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  UnitIntervalSchema,
} from "./common.js";
import { ReviewIssueSchema } from "./review-result.js";

export const REVIEW_DIMENSIONS = [
  "PUBLIC_RELATIONS",
  "OPERATIONS",
  "PRODUCT",
  "CUSTOMER",
  "COMPLIANCE_SAFETY",
] as const;

export const ReviewDimensionSchema = z.enum(REVIEW_DIMENSIONS);
export type ReviewDimension = z.infer<typeof ReviewDimensionSchema>;

export const ReviewDepthSchema = z.enum(["LIGHT", "FULL"]);
export type ReviewDepth = z.infer<typeof ReviewDepthSchema>;

export const ReviewEvidenceSourceSchema = z.enum([
  "BRAND_KNOWLEDGE",
  "HISTORICAL_PR_CASES",
  "PLATFORM_POLICY",
  "CAMPAIGN_BRIEF",
  "ACCOUNT_PROFILE",
  "PRODUCT_KNOWLEDGE",
  "APPROVED_CLAIMS",
  "SOCIAL_CONTEXT",
  "CUSTOMER_FAQ",
  "SERVICE_POLICY",
  "MULTIMODAL_EVIDENCE",
]);
export type ReviewEvidenceSource = z.infer<typeof ReviewEvidenceSourceSchema>;

const FiveDimensionDepthSchema = z.strictObject({
  PUBLIC_RELATIONS: ReviewDepthSchema,
  OPERATIONS: ReviewDepthSchema,
  PRODUCT: ReviewDepthSchema,
  CUSTOMER: ReviewDepthSchema,
  COMPLIANCE_SAFETY: ReviewDepthSchema,
});

function hasExactlyFiveDimensions(dimensions: ReviewDimension[]): boolean {
  return (
    dimensions.length === REVIEW_DIMENSIONS.length &&
    new Set(dimensions).size === REVIEW_DIMENSIONS.length &&
    REVIEW_DIMENSIONS.every((dimension) => dimensions.includes(dimension))
  );
}

export const ReviewPlanSchema = z
  .strictObject({
    requiredDimensions: z.array(ReviewDimensionSchema),
    reviewDepthByDimension: FiveDimensionDepthSchema,
    requiredEvidenceSources: z.array(ReviewEvidenceSourceSchema),
    requiresSocialContext: z.boolean(),
    requiresProductKnowledge: z.boolean(),
    requiresPlatformPolicy: z.boolean(),
    requiresVisualAnalysis: z.boolean(),
    planningReason: NonBlankStringSchema,
  })
  .refine(
    ({ requiredDimensions }) => hasExactlyFiveDimensions(requiredDimensions),
    {
      message: "requiredDimensions must contain all five unique dimensions.",
      path: ["requiredDimensions"],
    },
  );
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;

export const DimensionVerdictSchema = z.enum([
  "PASS",
  "WARN",
  "BLOCK",
  "REVIEW_REQUIRED",
]);
export type DimensionVerdict = z.infer<typeof DimensionVerdictSchema>;

export const RiskScoreSchema = z.number().min(0).max(100);

export const DimensionReviewResultSchema = z.strictObject({
  dimension: ReviewDimensionSchema,
  riskScore: RiskScoreSchema,
  confidence: UnitIntervalSchema,
  verdict: DimensionVerdictSchema,
  reason: NonBlankStringSchema,
  issues: z.array(ReviewIssueSchema),
  evidenceIds: z.array(NonBlankIdSchema),
  missingEvidence: z.array(ReviewEvidenceSourceSchema),
  suggestedChanges: z.array(NonBlankStringSchema),
});
export type DimensionReviewResult = z.infer<typeof DimensionReviewResultSchema>;

export const EvidenceConflictSchema = z.strictObject({
  dimensions: z.array(ReviewDimensionSchema).min(2),
  reason: NonBlankStringSchema,
  evidenceIds: z.array(NonBlankIdSchema),
});
export type EvidenceConflict = z.infer<typeof EvidenceConflictSchema>;

export const EvidenceCriticResultSchema = z.strictObject({
  supportedIssueIds: z.array(NonBlankIdSchema),
  unsupportedIssueIds: z.array(NonBlankIdSchema),
  conflicts: z.array(EvidenceConflictSchema),
  missingEvidence: z.array(ReviewEvidenceSourceSchema),
  requiresHuman: z.boolean(),
  reason: NonBlankStringSchema,
});
export type EvidenceCriticResult = z.infer<typeof EvidenceCriticResultSchema>;

export const FinalDecisionSchema = z.enum([
  "PASS",
  "REVISE",
  "HUMAN_REVIEW",
  "BLOCK",
]);
export type FinalDecision = z.infer<typeof FinalDecisionSchema>;

export const JudgeRecommendationSchema = z.strictObject({
  decision: FinalDecisionSchema,
  overallRiskScore: RiskScoreSchema,
  confidence: UnitIntervalSchema,
  summary: NonBlankStringSchema,
  topRisks: z.array(NonBlankStringSchema),
  revisionPriority: z.array(NonBlankStringSchema),
  judgeReason: NonBlankStringSchema,
});
export type JudgeRecommendation = z.infer<typeof JudgeRecommendationSchema>;

export const RevisionProposalIssueSchema = z.strictObject({
  issueId: NonBlankIdSchema,
  category: IssueCategorySchema,
  reason: NonBlankStringSchema,
});
export type RevisionProposalIssue = z.infer<typeof RevisionProposalIssueSchema>;

export const RevisionProposalSchema = z.strictObject({
  issues: z.array(RevisionProposalIssueSchema),
  revisionDirection: z.array(NonBlankStringSchema),
  suggestedContent: z.string().nullable(),
  reason: NonBlankStringSchema,
});
export type RevisionProposal = z.infer<typeof RevisionProposalSchema>;

export const EvidenceCoverageSchema = z.strictObject({
  requiredSources: z.array(ReviewEvidenceSourceSchema),
  availableSources: z.array(ReviewEvidenceSourceSchema),
  missingSources: z.array(ReviewEvidenceSourceSchema),
  coverageScore: UnitIntervalSchema,
});
export type EvidenceCoverage = z.infer<typeof EvidenceCoverageSchema>;

export const FinalReviewDecisionSchema = z
  .strictObject({
    decision: FinalDecisionSchema,
    publishable: z.boolean(),
    overallRiskScore: RiskScoreSchema,
    confidence: UnitIntervalSchema,
    summary: NonBlankStringSchema,
    dimensionResults: z.array(DimensionReviewResultSchema),
    blockingIssues: z.array(ReviewIssueSchema),
    revisionDirection: z.array(NonBlankStringSchema),
    evidenceCoverage: EvidenceCoverageSchema,
    judgeReason: NonBlankStringSchema,
  })
  .superRefine(({ decision, publishable, dimensionResults }, context) => {
    if (
      !hasExactlyFiveDimensions(
        dimensionResults.map(({ dimension }) => dimension),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "dimensionResults must contain all five unique dimensions.",
        path: ["dimensionResults"],
      });
    }
    if (publishable !== (decision === "PASS")) {
      context.addIssue({
        code: "custom",
        message: "publishable must be true if and only if decision is PASS.",
        path: ["publishable"],
      });
    }
  });
export type FinalReviewDecision = z.infer<typeof FinalReviewDecisionSchema>;

export const ReviewPolicySchema = z
  .strictObject({
    weights: z.strictObject({
      PUBLIC_RELATIONS: UnitIntervalSchema,
      OPERATIONS: UnitIntervalSchema,
      PRODUCT: UnitIntervalSchema,
      CUSTOMER: UnitIntervalSchema,
      COMPLIANCE_SAFETY: UnitIntervalSchema,
    }),
    thresholds: z.strictObject({
      passOverallMax: RiskScoreSchema,
      passDimensionMaxExclusive: RiskScoreSchema,
      reviseOverallMax: RiskScoreSchema,
      minimumConfidence: UnitIntervalSchema,
      disagreementThreshold: RiskScoreSchema,
    }),
    maxRevisionCount: z.number().int().min(1),
  })
  .superRefine(({ weights, thresholds }, context) => {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > Number.EPSILON * 10) {
      context.addIssue({
        code: "custom",
        message: "Review policy weights must sum to 1.",
        path: ["weights"],
      });
    }
    if (
      thresholds.passOverallMax > thresholds.reviseOverallMax ||
      thresholds.passDimensionMaxExclusive <= thresholds.passOverallMax
    ) {
      context.addIssue({
        code: "custom",
        message: "Review policy thresholds are inconsistent.",
        path: ["thresholds"],
      });
    }
  });
export type ReviewPolicy = z.infer<typeof ReviewPolicySchema>;
