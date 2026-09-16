import { describe, expect, it } from "@jest/globals";
import {
  ResumeReviewInputSchema,
  ReviewContextSchema,
  ReviewEngineInputSchema,
  ReviewEngineOutputSchema,
  ReviewFailureSchema,
} from "../../../src/pr-review/algorithm/index.js";
import type {
  ReviewContext,
  ReviewEngine,
  ReviewEngineInput,
  ReviewEngineOutput,
} from "../../../src/pr-review/algorithm/index.js";
import {
  contractTimestamp,
  createReviewResultFixture,
  createSocialContextSnapshotFixture,
} from "./fixtures.js";

const socialContextProvider = {
  async getSnapshot() {
    return createSocialContextSnapshotFixture();
  },
};

function createInput(): ReviewEngineInput {
  return {
    caseId: "case_contract_01",
    version: 1,
    contentType: "SOCIAL_POST",
    targetPlatform: ["LINKEDIN"],
    currentContent: "Contract content",
    imageUrls: [],
    currentStage: "REQUESTER_SELF_CHECK",
    policyVersion: "policy_v1",
  };
}

function createContext(): ReviewContext {
  return ReviewContextSchema.parse({
    requestId: "request_contract_01",
    deadlineAt: contractTimestamp,
    traceMetadata: { traceId: "trace_contract_01", version: 1 },
    cancellation: {
      aborted: false,
      throwIfAborted() {},
    },
    dependencies: { socialContextProvider },
  });
}

function createOutput(): ReviewEngineOutput {
  return {
    caseId: "case_contract_01",
    version: 1,
    results: [createReviewResultFixture()],
    aggregateResult: null,
    nextStage: "REVIEW_REQUIRED",
    requiresHuman: true,
    interrupt: {
      type: "HUMAN_REVIEW",
      stage: "REVIEW_REQUIRED",
      allowedActions: ["APPROVE", "REVISE", "REJECT", "ESCALATE"],
      reason: "Contract-only human review",
      requiredRole: "ACCOUNT_OPERATOR",
    },
    execution: {
      executionId: "execution_contract_01",
      threadId: "thread_contract_01",
      runId: null,
    },
    failures: [],
  };
}

const structuralEngine: ReviewEngine = {
  async review(_input, _context) {
    return createOutput();
  },
  async resume(_input, _context) {
    return createOutput();
  },
};

describe("ReviewEngine public contract", () => {
  it("validates public input/context/output and compiles the stable port", async () => {
    expect(ReviewEngineInputSchema.parse(createInput())).toEqual(createInput());
    expect(ReviewContextSchema.parse(createContext()).requestId).toBe(
      "request_contract_01",
    );
    expect(
      ReviewEngineOutputSchema.parse(
        await structuralEngine.review(createInput(), createContext()),
      ),
    ).toEqual(createOutput());
  });

  it("rejects unknown fields on engine objects", () => {
    expect(
      ReviewEngineInputSchema.safeParse({
        ...createInput(),
        httpRequest: {},
      }).success,
    ).toBe(false);
    expect(
      ReviewContextSchema.safeParse({
        ...createContext(),
        databaseClient: {},
      }).success,
    ).toBe(false);
    expect(
      ReviewEngineOutputSchema.safeParse({
        ...createOutput(),
        automaticApproval: true,
      }).success,
    ).toBe(false);
  });

  it("validates the ResumeReviewInput discriminated union", () => {
    expect(
      ResumeReviewInputSchema.safeParse({
        executionId: "execution_contract_01",
        caseId: "case_contract_01",
        version: 1,
        action: "REVISE",
        actor: {
          id: "actor_contract_01",
          displayName: "Contract Actor",
          role: "ACCOUNT_OPERATOR",
        },
        reason: "Revise contract content",
        revisedContent: "Revised content",
      }).success,
    ).toBe(true);
    expect(
      ResumeReviewInputSchema.safeParse({
        executionId: "execution_contract_01",
        caseId: "case_contract_01",
        version: 1,
        action: "APPROVE",
        actor: {
          id: "actor_contract_01",
          displayName: "Contract Actor",
          role: "ACCOUNT_OPERATOR",
        },
        reason: "Approve contract content",
        revisedContent: "not-allowed",
      }).success,
    ).toBe(false);
  });

  it("accepts typed failures and rejects unknown/fail-open shapes", () => {
    const failure = {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Contract dependency unavailable",
      retryable: true,
      source: "SOCIAL_CONTEXT",
      details: { provider: "contract-only", attempts: 1 },
    };
    expect(ReviewFailureSchema.safeParse(failure).success).toBe(true);
    expect(
      ReviewFailureSchema.safeParse({ ...failure, code: "UNKNOWN_FAILURE" })
        .success,
    ).toBe(false);
    expect(
      ReviewFailureSchema.safeParse({ ...failure, retryable: "yes" }).success,
    ).toBe(false);
    expect(
      ReviewFailureSchema.safeParse({
        ...failure,
        automaticApproval: true,
      }).success,
    ).toBe(false);
  });

  it("preserves serializable output through JSON round trip", () => {
    const parsed = ReviewEngineOutputSchema.parse(createOutput());
    expect(
      ReviewEngineOutputSchema.parse(JSON.parse(JSON.stringify(parsed))),
    ).toEqual(parsed);
  });
});
