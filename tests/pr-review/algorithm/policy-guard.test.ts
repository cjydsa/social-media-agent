import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_REVIEW_POLICY,
  applyPolicyGuard,
  type EvidenceCoverage,
  type EvidenceCriticResult,
  type JudgeRecommendation,
} from "../../../src/pr-review/algorithm/index.js";
import { createDimensionResult, fiveDimensionResults } from "./fixtures.js";

const critic: EvidenceCriticResult = {
  supportedIssueIds: [],
  unsupportedIssueIds: [],
  conflicts: [],
  missingEvidence: [],
  requiresHuman: false,
  reason: "Synthetic evidence complete.",
};

const judgePass: JudgeRecommendation = {
  decision: "PASS",
  overallRiskScore: 5,
  confidence: 0.9,
  summary: "Judge recommends pass.",
  topRisks: [],
  revisionPriority: [],
  judgeReason: "Synthetic judge.",
};

const coverage: EvidenceCoverage = {
  requiredSources: [],
  availableSources: [],
  missingSources: [],
  coverageScore: 1,
};

describe("deterministic Policy Guard", () => {
  it("allows the normal low-risk path", () => {
    const result = applyPolicyGuard({
      dimensionResults: fiveDimensionResults(),
      critic,
      judge: judgePass,
      evidenceCoverage: coverage,
      failures: [],
      policy: DEFAULT_REVIEW_POLICY,
    });
    expect(result.decision).toBe("PASS");
    expect(result.publishable).toBe(true);
  });

  it.each([
    ["CRITICAL", "SENSITIVE_CONTENT"],
    ["HIGH", "PRIVACY"],
    ["HIGH", "CONFIDENTIAL_INFORMATION"],
    ["HIGH", "UNSUPPORTED_PRODUCT_CLAIM"],
  ] as const)("prevents Judge PASS for %s %s", (severity, category) => {
    const results = fiveDimensionResults();
    const target =
      category === "UNSUPPORTED_PRODUCT_CLAIM"
        ? "PRODUCT"
        : "COMPLIANCE_SAFETY";
    const index = results.findIndex(({ dimension }) => dimension === target);
    results[index] = createDimensionResult(target, {
      riskScore: 10,
      verdict: "WARN",
      issues: [
        {
          id: `issue-${category}`,
          category,
          severity,
          textSpan: null,
          reason: "Synthetic hard blocker.",
          evidenceIds: [],
          suggestion: "Remove blocker.",
        },
      ],
    });
    const result = applyPolicyGuard({
      dimensionResults: results,
      critic,
      judge: judgePass,
      evidenceCoverage: coverage,
      failures: [],
      policy: DEFAULT_REVIEW_POLICY,
    });
    expect(result.decision).toBe("BLOCK");
    expect(result.publishable).toBe(false);
  });

  it("fails closed on reviewer failure even with low weighted score", () => {
    const result = applyPolicyGuard({
      dimensionResults: fiveDimensionResults(),
      critic,
      judge: judgePass,
      evidenceCoverage: coverage,
      failures: [
        {
          code: "REVIEWER_FAILED",
          message: "Synthetic failure.",
          retryable: false,
          source: "MODEL",
          details: null,
        },
      ],
      policy: DEFAULT_REVIEW_POLICY,
    });
    expect(result.decision).toBe("HUMAN_REVIEW");
    expect(result.publishable).toBe(false);
  });

  it("routes missing evidence and specialist disagreement to human review", () => {
    const missing = applyPolicyGuard({
      dimensionResults: fiveDimensionResults(),
      critic: {
        ...critic,
        requiresHuman: true,
        missingEvidence: ["PRODUCT_KNOWLEDGE"],
      },
      judge: judgePass,
      evidenceCoverage: {
        requiredSources: ["PRODUCT_KNOWLEDGE"],
        availableSources: [],
        missingSources: ["PRODUCT_KNOWLEDGE"],
        coverageScore: 0,
      },
      failures: [],
      policy: DEFAULT_REVIEW_POLICY,
    });
    const conflict = applyPolicyGuard({
      dimensionResults: fiveDimensionResults(),
      critic: {
        ...critic,
        conflicts: [
          {
            dimensions: ["PUBLIC_RELATIONS", "PRODUCT"],
            reason: "Synthetic specialist disagreement.",
            evidenceIds: ["evidence-conflict-1"],
          },
        ],
      },
      judge: judgePass,
      evidenceCoverage: coverage,
      failures: [],
      policy: DEFAULT_REVIEW_POLICY,
    });
    expect(missing.decision).toBe("HUMAN_REVIEW");
    expect(conflict.decision).toBe("HUMAN_REVIEW");
  });
});
