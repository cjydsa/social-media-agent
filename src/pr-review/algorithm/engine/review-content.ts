import type { ReviewEngine } from "../ports/review-engine.js";
import {
  FinalReviewDecisionSchema,
  REVIEW_DIMENSIONS,
  type DimensionReviewResult,
  type FinalReviewDecision,
} from "../schemas/multi-agent.js";
import {
  ReviewContextSchema,
  type ReviewContext,
  type ReviewEngineInput,
  type ReviewFailure,
} from "../schemas/review-engine.js";
import { createLangGraphReviewEngine } from "./langgraph-review-engine.js";

export interface ReviewContentOptions {
  engine?: ReviewEngine;
  context?: ReviewContext;
}

function defaultContext(input: ReviewEngineInput): ReviewContext {
  return ReviewContextSchema.parse({
    requestId: `review-content-${input.caseId}-v${input.version}`,
    deadlineAt: null,
    traceMetadata: {},
    cancellation: null,
    dependencies: {
      socialContextProvider: null,
    },
  });
}

function failClosedDimensionResult(
  dimension: (typeof REVIEW_DIMENSIONS)[number],
  failure: ReviewFailure | null,
): DimensionReviewResult {
  return {
    dimension,
    riskScore: 100,
    confidence: 0,
    verdict: "REVIEW_REQUIRED",
    reason:
      failure?.message ?? "ReviewEngine did not return FinalReviewDecision.",
    issues: [
      {
        id: `facade-fail-closed-${dimension.toLowerCase()}`,
        category: "COMPLIANCE",
        severity: "HIGH",
        textSpan: null,
        reason:
          failure?.message ?? "Missing final decision requires human review.",
        evidenceIds: [],
        suggestion: "请人工复核审核执行结果。",
      },
    ],
    evidenceIds: [],
    missingEvidence: [],
    suggestedChanges: ["请人工复核后再决定是否发布。"],
  };
}

function failClosedDecision(
  failures: readonly ReviewFailure[],
): FinalReviewDecision {
  const primaryFailure = failures[0] ?? null;
  const dimensionResults = REVIEW_DIMENSIONS.map((dimension) =>
    failClosedDimensionResult(dimension, primaryFailure),
  );
  return FinalReviewDecisionSchema.parse({
    decision: "HUMAN_REVIEW",
    publishable: false,
    overallRiskScore: 100,
    confidence: 0,
    summary:
      primaryFailure?.message ??
      "ReviewEngine did not produce a final decision; human review is required.",
    dimensionResults,
    blockingIssues: dimensionResults.flatMap((result) => result.issues),
    revisionDirection: ["请人工复核审核执行结果。"],
    evidenceCoverage: {
      requiredSources: [],
      availableSources: [],
      missingSources: [],
      coverageScore: 0,
    },
    judgeReason: "Headless facade fail-closed fallback.",
  });
}

export async function reviewContent(
  input: ReviewEngineInput,
  options: ReviewContentOptions = {},
): Promise<FinalReviewDecision> {
  const engine = options.engine ?? createLangGraphReviewEngine();
  const output = await engine.review(
    input,
    options.context ?? defaultContext(input),
  );
  if (output.finalDecision) {
    return FinalReviewDecisionSchema.parse(output.finalDecision);
  }
  return failClosedDecision(output.failures);
}
