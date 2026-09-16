import { describe, expect, it } from "@jest/globals";
import type {
  FinalReviewDecision,
  ReviewContext,
  ReviewEngine,
  ReviewEngineInput,
  ReviewEngineOutput,
  ResumeReviewInput,
} from "../../../src/pr-review/algorithm/index.js";
import { reviewContent } from "../../../src/pr-review/algorithm/index.js";
import { createReviewResultFixture } from "../contracts/fixtures.js";

function input(): ReviewEngineInput {
  return {
    caseId: "case_facade_1",
    version: 1,
    contentType: "SOCIAL_POST",
    targetPlatform: ["WEIBO"],
    currentContent: "正常内容",
    imageUrls: [],
    currentStage: "REQUESTER_SELF_CHECK",
    policyVersion: "policy-v1",
  };
}

function finalDecision(): FinalReviewDecision {
  const dimensions = [
    "PUBLIC_RELATIONS",
    "OPERATIONS",
    "PRODUCT",
    "CUSTOMER",
    "COMPLIANCE_SAFETY",
  ] as const;
  return {
    decision: "PASS",
    publishable: true,
    overallRiskScore: 5,
    confidence: 0.9,
    summary: "低风险。",
    dimensionResults: dimensions.map((dimension) => ({
      dimension,
      riskScore: 5,
      confidence: 0.9,
      verdict: "PASS",
      reason: "低风险。",
      issues: [],
      evidenceIds: [],
      missingEvidence: [],
      suggestedChanges: [],
    })),
    blockingIssues: [],
    revisionDirection: [],
    evidenceCoverage: {
      requiredSources: [],
      availableSources: [],
      missingSources: [],
      coverageScore: 1,
    },
    judgeReason: "低风险。",
  };
}

class FakeEngine implements ReviewEngine {
  constructor(private readonly output: ReviewEngineOutput) {}

  async review(
    _input: ReviewEngineInput,
    _context: ReviewContext,
  ): Promise<ReviewEngineOutput> {
    return this.output;
  }

  async resume(
    _input: ResumeReviewInput,
    _context: ReviewContext,
  ): Promise<ReviewEngineOutput> {
    return this.output;
  }
}

describe("ALG-004 reviewContent facade", () => {
  it("returns the ReviewEngine final decision without reimplementing graph", async () => {
    const decision = finalDecision();
    const result = await reviewContent(input(), {
      engine: new FakeEngine({
        caseId: "case_facade_1",
        version: 1,
        results: [createReviewResultFixture()],
        aggregateResult: createReviewResultFixture(),
        nextStage: "COMPLETED",
        requiresHuman: false,
        interrupt: null,
        execution: {
          executionId: "exec_facade_1",
          threadId: "thread_facade_1",
          runId: null,
        },
        failures: [],
        finalDecision: decision,
      }),
    });

    expect(result).toEqual(decision);
  });

  it("fails closed when the engine output has no FinalReviewDecision", async () => {
    const result = await reviewContent(input(), {
      engine: new FakeEngine({
        caseId: "case_facade_1",
        version: 1,
        results: [],
        aggregateResult: null,
        nextStage: "REVIEW_REQUIRED",
        requiresHuman: true,
        interrupt: null,
        execution: {
          executionId: "exec_facade_2",
          threadId: "thread_facade_2",
          runId: null,
        },
        failures: [
          {
            code: "REVIEWER_FAILED",
            message: "Mocked engine failure.",
            retryable: false,
            source: "MODEL",
            details: null,
          },
        ],
      }),
    });

    expect(result.decision).toBe("HUMAN_REVIEW");
    expect(result.publishable).toBe(false);
    expect(result.dimensionResults).toHaveLength(5);
    expect(result.blockingIssues[0]?.reason).toContain("Mocked engine failure");
  });
});
