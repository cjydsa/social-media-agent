import {
  ReviewPolicySchema,
  type ReviewPolicy,
} from "../schemas/multi-agent.js";

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = ReviewPolicySchema.parse({
  weights: {
    PUBLIC_RELATIONS: 0.25,
    OPERATIONS: 0.15,
    PRODUCT: 0.2,
    CUSTOMER: 0.2,
    COMPLIANCE_SAFETY: 0.2,
  },
  thresholds: {
    passOverallMax: 25,
    passDimensionMaxExclusive: 40,
    reviseOverallMax: 49,
    minimumConfidence: 0.75,
    disagreementThreshold: 30,
  },
  maxRevisionCount: 3,
});

export function parseReviewPolicy(policy?: ReviewPolicy): ReviewPolicy {
  return ReviewPolicySchema.parse(policy ?? DEFAULT_REVIEW_POLICY);
}
