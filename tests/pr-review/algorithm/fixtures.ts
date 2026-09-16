import type {
  DimensionReviewResult,
  ReviewContext,
  ReviewEngineInput,
} from "../../../src/pr-review/algorithm/index.js";

export function createAlgorithmInput(
  scenario = "normal",
  caseId = `case-${scenario}`,
): ReviewEngineInput {
  return {
    caseId,
    version: 1,
    contentType: "SOCIAL_POST",
    targetPlatform: ["weibo"],
    currentContent: `[scenario:${scenario}] synthetic contract-only content`,
    imageUrls: [],
    currentStage: "REQUESTER_SELF_CHECK",
    policyVersion: "five-dimension-mvp-v1",
    originalContent: `[scenario:${scenario}] synthetic contract-only content`,
  };
}

export function createAlgorithmContext(): ReviewContext {
  return {
    requestId: "request-algorithm-test",
    deadlineAt: "2099-08-31T08:00:00.000Z",
    traceMetadata: { fixture: "synthetic" },
    cancellation: null,
    dependencies: { socialContextProvider: null },
  };
}

export function createDimensionResult(
  dimension: DimensionReviewResult["dimension"],
  overrides: Partial<DimensionReviewResult> = {},
): DimensionReviewResult {
  return {
    dimension,
    riskScore: 5,
    confidence: 0.9,
    verdict: "PASS",
    reason: "Synthetic dimension result.",
    issues: [],
    evidenceIds: [],
    missingEvidence: [],
    suggestedChanges: [],
    ...overrides,
  };
}

export const fiveDimensionResults = () =>
  [
    "PUBLIC_RELATIONS",
    "OPERATIONS",
    "PRODUCT",
    "CUSTOMER",
    "COMPLIANCE_SAFETY",
  ].map((dimension) =>
    createDimensionResult(dimension as DimensionReviewResult["dimension"]),
  );
