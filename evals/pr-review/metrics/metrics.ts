import {
  REVIEW_DIMENSIONS,
  type FinalDecision,
  type ReviewDimension,
  type Severity,
} from "../../../src/pr-review/algorithm/index.js";
import {
  BenchmarkMetricsSchema,
  BenchmarkRunCaseResultSchema,
  type BenchmarkMetrics,
  type BenchmarkRunCaseResult,
} from "../schemas.js";

function intersectionSize<T>(left: readonly T[], right: readonly T[]): number {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function safeRatio(
  numerator: number,
  denominator: number,
  emptyValue = 0,
): number {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

function isHighRisk(severity: Severity | null): boolean {
  return severity === "HIGH" || severity === "CRITICAL";
}

function isManualReview(decision: FinalDecision): boolean {
  return decision === "HUMAN_REVIEW";
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateMacroF1(results: readonly BenchmarkRunCaseResult[]): number {
  const scores = REVIEW_DIMENSIONS.map((dimension: ReviewDimension) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;

    for (const result of results) {
      const expected = result.expectedDimensions.includes(dimension);
      const actual = result.actualDimensions.includes(dimension);
      if (expected && actual) truePositive += 1;
      if (!expected && actual) falsePositive += 1;
      if (expected && !actual) falseNegative += 1;
    }

    const precision = safeRatio(truePositive, truePositive + falsePositive, 1);
    const recall = safeRatio(truePositive, truePositive + falseNegative, 1);
    return f1(precision, recall);
  });
  return average(scores);
}

export function calculateBenchmarkMetrics(
  input: readonly BenchmarkRunCaseResult[],
): BenchmarkMetrics {
  const results = input.map((result) =>
    BenchmarkRunCaseResultSchema.parse(result),
  );
  const expectedDimensionCount = results.reduce(
    (sum, result) => sum + result.expectedDimensions.length,
    0,
  );
  const actualDimensionCount = results.reduce(
    (sum, result) => sum + result.actualDimensions.length,
    0,
  );
  const correctDimensionCount = results.reduce(
    (sum, result) =>
      sum +
      intersectionSize(result.expectedDimensions, result.actualDimensions),
    0,
  );
  const dimensionPrecision = safeRatio(
    correctDimensionCount,
    actualDimensionCount,
    expectedDimensionCount === 0 ? 1 : 0,
  );
  const dimensionRecall = safeRatio(
    correctDimensionCount,
    expectedDimensionCount,
    actualDimensionCount === 0 ? 1 : 0,
  );
  const highRiskCases = results.filter((result) =>
    isHighRisk(result.expectedSeverity),
  );
  const correctlyDetectedHighRisk = highRiskCases.filter((result) =>
    isHighRisk(result.actualMaxSeverity),
  ).length;
  const falsePassedHighRisk = highRiskCases.filter(
    (result) => result.actualDecision === "PASS",
  ).length;
  const evidenceRequiredCases = results.filter(
    (result) => result.requiredEvidence.length > 0,
  );
  const coveredEvidenceCases = evidenceRequiredCases.filter((result) =>
    result.requiredEvidence.every((evidence) =>
      result.citedEvidence.includes(evidence),
    ),
  ).length;
  const citedEvidenceTotal = results.reduce(
    (sum, result) => sum + result.citedEvidence.length,
    0,
  );
  const validEvidenceCitations = results.reduce(
    (sum, result) =>
      sum + intersectionSize(result.citedEvidence, result.requiredEvidence),
    0,
  );
  const nonNullCosts = results
    .map((result) => result.estimatedCost)
    .filter((value): value is number => value !== null);

  return BenchmarkMetricsSchema.parse({
    dimensionPrecision,
    dimensionRecall,
    dimensionF1: f1(dimensionPrecision, dimensionRecall),
    macroF1: calculateMacroF1(results),
    highRiskRecall: safeRatio(
      correctlyDetectedHighRisk,
      highRiskCases.length,
      1,
    ),
    highRiskFalsePassRate: safeRatio(
      falsePassedHighRisk,
      highRiskCases.length,
      0,
    ),
    decisionAccuracy: safeRatio(
      results.filter(
        (result) => result.expectedDecision === result.actualDecision,
      ).length,
      results.length,
      1,
    ),
    manualReviewRate: safeRatio(
      results.filter((result) => isManualReview(result.actualDecision)).length,
      results.length,
      0,
    ),
    evidenceCoverage: safeRatio(
      coveredEvidenceCases,
      evidenceRequiredCases.length,
      1,
    ),
    evidenceCitationPrecision: safeRatio(
      validEvidenceCitations,
      citedEvidenceTotal,
      1,
    ),
    schemaParseSuccessRate: safeRatio(
      results.filter((result) => result.schemaParseSuccess).length,
      results.length,
      1,
    ),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    p95LatencyMs: percentile95(results.map((result) => result.latencyMs)),
    averageInputTokens: average(results.map((result) => result.inputTokens)),
    averageOutputTokens: average(results.map((result) => result.outputTokens)),
    averageCostPerCase:
      nonNullCosts.length === 0 ? null : average(nonNullCosts),
  });
}
