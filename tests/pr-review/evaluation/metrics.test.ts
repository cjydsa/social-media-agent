import { describe, expect, it } from "@jest/globals";
import {
  BenchmarkMetricsSchema,
  calculateBenchmarkMetrics,
} from "../../../evals/pr-review/index.js";

describe("TEST-004 benchmark metrics", () => {
  it("calculates decision, dimension, evidence, latency, token, and cost metrics", () => {
    const metrics = calculateBenchmarkMetrics([
      {
        caseId: "case_metric_1",
        expectedDecision: "BLOCK",
        actualDecision: "BLOCK",
        expectedDimensions: ["COMPLIANCE_SAFETY", "PRODUCT"],
        actualDimensions: ["COMPLIANCE_SAFETY"],
        expectedSeverity: "HIGH",
        actualMaxSeverity: "HIGH",
        requiredEvidence: ["PRODUCT_KNOWLEDGE"],
        citedEvidence: ["PRODUCT_KNOWLEDGE"],
        schemaParseSuccess: true,
        latencyMs: 100,
        inputTokens: 20,
        outputTokens: 10,
        estimatedCost: 0.02,
      },
      {
        caseId: "case_metric_2",
        expectedDecision: "PASS",
        actualDecision: "HUMAN_REVIEW",
        expectedDimensions: [],
        actualDimensions: ["PUBLIC_RELATIONS"],
        expectedSeverity: "LOW",
        actualMaxSeverity: "MEDIUM",
        requiredEvidence: [],
        citedEvidence: ["SOCIAL_CONTEXT"],
        schemaParseSuccess: false,
        latencyMs: 200,
        inputTokens: 40,
        outputTokens: 30,
        estimatedCost: null,
      },
    ]);

    expect(BenchmarkMetricsSchema.parse(metrics)).toEqual(metrics);
    expect(metrics.dimensionPrecision).toBeCloseTo(0.5);
    expect(metrics.dimensionRecall).toBeCloseTo(0.5);
    expect(metrics.highRiskRecall).toBe(1);
    expect(metrics.highRiskFalsePassRate).toBe(0);
    expect(metrics.decisionAccuracy).toBe(0.5);
    expect(metrics.manualReviewRate).toBe(0.5);
    expect(metrics.evidenceCoverage).toBe(1);
    expect(metrics.evidenceCitationPrecision).toBe(0.5);
    expect(metrics.schemaParseSuccessRate).toBe(0.5);
    expect(metrics.averageLatencyMs).toBe(150);
    expect(metrics.p95LatencyMs).toBe(200);
    expect(metrics.averageInputTokens).toBe(30);
    expect(metrics.averageOutputTokens).toBe(20);
    expect(metrics.averageCostPerCase).toBe(0.02);
  });
});
