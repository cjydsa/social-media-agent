import type { ReviewFailure } from "../schemas/review-engine.js";
import type { ReviewIssue } from "../schemas/review-result.js";
import {
  FinalReviewDecisionSchema,
  type DimensionReviewResult,
  type EvidenceCriticResult,
  type EvidenceCoverage,
  type FinalDecision,
  type FinalReviewDecision,
  type JudgeRecommendation,
  type ReviewPolicy,
} from "../schemas/multi-agent.js";

export interface PolicyGuardInput {
  dimensionResults: DimensionReviewResult[];
  critic: EvidenceCriticResult;
  judge: JudgeRecommendation;
  evidenceCoverage: EvidenceCoverage;
  failures: ReviewFailure[];
  policy: ReviewPolicy;
}

const severityRank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;

function isHardBlocker(
  result: DimensionReviewResult,
  issue: ReviewIssue,
): boolean {
  if (issue.severity === "CRITICAL") return true;
  if (
    result.dimension === "COMPLIANCE_SAFETY" &&
    severityRank[issue.severity] >= severityRank.HIGH
  ) {
    return true;
  }
  if (
    issue.category === "UNSUPPORTED_PRODUCT_CLAIM" &&
    severityRank[issue.severity] >= severityRank.HIGH
  ) {
    return true;
  }
  return (
    issue.category === "PRIVACY" ||
    issue.category === "CONFIDENTIAL_INFORMATION"
  );
}

function weightedScore(
  results: DimensionReviewResult[],
  policy: ReviewPolicy,
): number {
  return results.reduce(
    (total, result) =>
      total + result.riskScore * policy.weights[result.dimension],
    0,
  );
}

function guardedDecision(
  input: PolicyGuardInput,
  hardBlockers: ReviewIssue[],
  overallRiskScore: number,
  confidence: number,
): FinalDecision {
  if (hardBlockers.length > 0) return "BLOCK";

  const hasMissingEvidence =
    input.evidenceCoverage.missingSources.length > 0 ||
    input.dimensionResults.some(
      ({ missingEvidence }) => missingEvidence.length > 0,
    );

  if (
    input.failures.length > 0 ||
    input.critic.requiresHuman ||
    hasMissingEvidence ||
    confidence < input.policy.thresholds.minimumConfidence ||
    input.critic.conflicts.length > 0
  ) {
    return "HUMAN_REVIEW";
  }

  if (
    overallRiskScore <= input.policy.thresholds.passOverallMax &&
    input.dimensionResults.every(
      ({ riskScore }) =>
        riskScore < input.policy.thresholds.passDimensionMaxExclusive,
    ) &&
    input.dimensionResults.every(({ issues }) =>
      issues.every(
        ({ severity }) => severityRank[severity] < severityRank.HIGH,
      ),
    )
  ) {
    return "PASS";
  }

  if (
    overallRiskScore <= input.policy.thresholds.reviseOverallMax ||
    input.dimensionResults.some(({ verdict }) => verdict === "WARN")
  ) {
    return "REVISE";
  }

  return input.judge.decision === "BLOCK" ? "BLOCK" : "HUMAN_REVIEW";
}

export function applyPolicyGuard(input: PolicyGuardInput): FinalReviewDecision {
  const hardBlockers = input.dimensionResults.flatMap((result) =>
    result.issues.filter((issue) => isHardBlocker(result, issue)),
  );
  const overallRiskScore = weightedScore(input.dimensionResults, input.policy);
  const confidence = Math.min(
    input.judge.confidence,
    ...input.dimensionResults.map((result) => result.confidence),
  );
  const decision = guardedDecision(
    input,
    hardBlockers,
    overallRiskScore,
    confidence,
  );
  const revisionDirection = [
    ...new Set(
      input.dimensionResults.flatMap(
        ({ suggestedChanges }) => suggestedChanges,
      ),
    ),
  ];

  return FinalReviewDecisionSchema.parse({
    decision,
    publishable: decision === "PASS",
    overallRiskScore,
    confidence,
    summary:
      decision === input.judge.decision
        ? input.judge.summary
        : `Policy Guard tightened Judge decision ${input.judge.decision} to ${decision}.`,
    dimensionResults: input.dimensionResults,
    blockingIssues: hardBlockers,
    revisionDirection,
    evidenceCoverage: input.evidenceCoverage,
    judgeReason: input.judge.judgeReason,
  });
}
