import { describe, expect, it } from "@jest/globals";
import {
  DimensionReviewResultSchema,
  EvidenceCriticResultSchema,
  FinalReviewDecisionSchema,
  JudgeRecommendationSchema,
  ReviewPlanSchema,
  ReviewPolicySchema,
} from "../../../src/pr-review/algorithm/index.js";
import { DEFAULT_REVIEW_POLICY } from "../../../src/pr-review/algorithm/index.js";
import { createDimensionResult, fiveDimensionResults } from "./fixtures.js";

describe("v1.1 multi-agent contracts", () => {
  it("accepts riskScore boundaries and rejects out-of-range values", () => {
    expect(
      DimensionReviewResultSchema.safeParse(
        createDimensionResult("PRODUCT", { riskScore: 0 }),
      ).success,
    ).toBe(true);
    expect(
      DimensionReviewResultSchema.safeParse(
        createDimensionResult("PRODUCT", { riskScore: 100 }),
      ).success,
    ).toBe(true);
    expect(
      DimensionReviewResultSchema.safeParse(
        createDimensionResult("PRODUCT", { riskScore: -0.01 }),
      ).success,
    ).toBe(false);
    expect(
      DimensionReviewResultSchema.safeParse(
        createDimensionResult("PRODUCT", { riskScore: 100.01 }),
      ).success,
    ).toBe(false);
  });

  it("requires an exact five-dimension plan and strict nested fields", () => {
    const plan = {
      requiredDimensions: fiveDimensionResults().map(
        ({ dimension }) => dimension,
      ),
      reviewDepthByDimension: {
        PUBLIC_RELATIONS: "LIGHT",
        OPERATIONS: "LIGHT",
        PRODUCT: "FULL",
        CUSTOMER: "LIGHT",
        COMPLIANCE_SAFETY: "LIGHT",
      },
      requiredEvidenceSources: ["PRODUCT_KNOWLEDGE"],
      requiresSocialContext: false,
      requiresProductKnowledge: true,
      requiresPlatformPolicy: false,
      requiresVisualAnalysis: false,
      planningReason: "Synthetic plan.",
    };
    expect(ReviewPlanSchema.safeParse(plan).success).toBe(true);
    expect(
      ReviewPlanSchema.safeParse({
        ...plan,
        requiredDimensions: ["PRODUCT"],
      }).success,
    ).toBe(false);
    expect(
      ReviewPlanSchema.safeParse({
        ...plan,
        reviewDepthByDimension: {
          ...plan.reviewDepthByDimension,
          unexpected: "LIGHT",
        },
      }).success,
    ).toBe(false);
  });

  it("validates critic, judge, final decision and JSON round-trip", () => {
    const critic = EvidenceCriticResultSchema.parse({
      supportedIssueIds: [],
      unsupportedIssueIds: [],
      conflicts: [],
      missingEvidence: [],
      requiresHuman: false,
      reason: "Synthetic evidence is complete.",
    });
    const judge = JudgeRecommendationSchema.parse({
      decision: "PASS",
      overallRiskScore: 5,
      confidence: 0.9,
      summary: "Synthetic pass.",
      topRisks: [],
      revisionPriority: [],
      judgeReason: "Synthetic judge recommendation.",
    });
    const finalDecision = FinalReviewDecisionSchema.parse({
      decision: judge.decision,
      overallRiskScore: judge.overallRiskScore,
      confidence: judge.confidence,
      summary: judge.summary,
      judgeReason: judge.judgeReason,
      publishable: true,
      dimensionResults: fiveDimensionResults(),
      blockingIssues: [],
      revisionDirection: [],
      evidenceCoverage: {
        requiredSources: [],
        availableSources: [],
        missingSources: [],
        coverageScore: 1,
      },
    });

    expect(critic.requiresHuman).toBe(false);
    expect(
      FinalReviewDecisionSchema.parse(
        JSON.parse(JSON.stringify(finalDecision)),
      ),
    ).toEqual(finalDecision);
    expect(
      FinalReviewDecisionSchema.safeParse({
        ...finalDecision,
        decision: "BLOCK",
        publishable: true,
      }).success,
    ).toBe(false);
  });

  it("requires policy weights to sum to one", () => {
    expect(ReviewPolicySchema.safeParse(DEFAULT_REVIEW_POLICY).success).toBe(
      true,
    );
    expect(
      ReviewPolicySchema.safeParse({
        ...DEFAULT_REVIEW_POLICY,
        weights: { ...DEFAULT_REVIEW_POLICY.weights, PRODUCT: 0.4 },
      }).success,
    ).toBe(false);
  });
});
