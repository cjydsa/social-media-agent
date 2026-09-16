import { describe, expect, it } from "@jest/globals";
import type { z } from "zod";
import {
  LLMDecisionJudge,
  LLMDimensionReviewer,
  LLMEvidenceCritic,
  LLMRevisionAgent,
  LLMReviewPlanner,
  RoleModelPolicySchema,
  type StructuredOutputModel,
} from "../../../src/pr-review/algorithm/index.js";
import {
  criticPromptDescriptor,
  judgePromptDescriptor,
  plannerPromptDescriptor,
  revisionPromptDescriptor,
  specialistPromptDescriptor,
} from "../../../src/pr-review/algorithm/prompts/descriptors.js";
import { createReviewCaseFixture } from "../contracts/fixtures.js";

class FakeStructuredModel implements StructuredOutputModel {
  calls = 0;

  constructor(private readonly responses: unknown[]) {}

  withStructuredOutput(_schema: z.ZodTypeAny) {
    return {
      invoke: async () => {
        const response =
          this.responses[Math.min(this.calls, this.responses.length - 1)];
        this.calls += 1;
        if (response instanceof Error) throw response;
        return response;
      },
    };
  }
}

const plan = {
  requiredDimensions: [
    "PUBLIC_RELATIONS",
    "OPERATIONS",
    "PRODUCT",
    "CUSTOMER",
    "COMPLIANCE_SAFETY",
  ],
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
  planningReason: "需要核对产品声明。",
};

const dimensionResult = {
  dimension: "PRODUCT",
  riskScore: 72,
  confidence: 0.8,
  verdict: "REVIEW_REQUIRED",
  reason: "产品声明缺少证据。",
  issues: [],
  evidenceIds: [],
  missingEvidence: ["PRODUCT_KNOWLEDGE"],
  suggestedChanges: ["补充批准声明或弱化表达。"],
};

describe("ALG-004 LLM structured agents", () => {
  it("uses role model policy schema", () => {
    expect(
      RoleModelPolicySchema.parse({
        executionMode: "hybrid",
        planner: { provider: "deepseek", model: "deepseek-v4-flash" },
        specialist: { provider: "deepseek", model: "deepseek-v4-flash" },
        critic: { provider: "qwen", model: "qwen-test" },
        judge: { provider: "qwen", model: "qwen-test" },
        revision: { provider: "deepseek", model: "deepseek-v4-flash" },
      }),
    ).toMatchObject({ executionMode: "hybrid" });
  });

  it("parses valid structured outputs for planner, specialist, critic, judge, and revision", async () => {
    const planner = new LLMReviewPlanner({
      model: new FakeStructuredModel([plan]),
      prompt: plannerPromptDescriptor,
    });
    const specialist = new LLMDimensionReviewer({
      model: new FakeStructuredModel([dimensionResult]),
      prompt: specialistPromptDescriptor,
      dimension: "PRODUCT",
    });
    const critic = new LLMEvidenceCritic({
      model: new FakeStructuredModel([
        {
          supportedIssueIds: [],
          unsupportedIssueIds: [],
          conflicts: [],
          missingEvidence: ["PRODUCT_KNOWLEDGE"],
          requiresHuman: true,
          reason: "缺少产品证据。",
        },
      ]),
      prompt: criticPromptDescriptor,
    });
    const judge = new LLMDecisionJudge({
      model: new FakeStructuredModel([
        {
          decision: "HUMAN_REVIEW",
          overallRiskScore: 70,
          confidence: 0.7,
          summary: "产品证据不足。",
          topRisks: ["unsupported product claim"],
          revisionPriority: ["补充证据"],
          judgeReason: "缺少 required evidence。",
        },
      ]),
      prompt: judgePromptDescriptor,
    });
    const revision = new LLMRevisionAgent({
      model: new FakeStructuredModel([
        {
          issues: [
            {
              issueId: "issue_product_1",
              category: "UNSUPPORTED_PRODUCT_CLAIM",
              reason: "缺少批准声明。",
            },
          ],
          revisionDirection: ["删除行业第一，改为有证据支持的描述。"],
          suggestedContent: null,
          reason: "避免无证据产品声明。",
        },
      ]),
      prompt: revisionPromptDescriptor,
    });

    expect(
      await planner.plan({
        ...createReviewCaseFixture(),
        caseId: "case_1",
        policyVersion: "policy-v1",
      }),
    ).toMatchObject({
      requiresProductKnowledge: true,
    });
    expect(await specialist.review({ content: "行业第一" })).toMatchObject({
      dimension: "PRODUCT",
      missingEvidence: ["PRODUCT_KNOWLEDGE"],
    });
    expect(await critic.critique({})).toMatchObject({ requiresHuman: true });
    expect(await judge.judge({})).toMatchObject({ decision: "HUMAN_REVIEW" });
    expect(await revision.revise({})).toMatchObject({
      revisionDirection: expect.arrayContaining([
        expect.stringContaining("行业第一"),
      ]),
    });
  });

  it("retries parse failure and fails closed after timeout", async () => {
    const retryModel = new FakeStructuredModel([{ invalid: true }, plan]);
    const planner = new LLMReviewPlanner({
      model: retryModel,
      prompt: plannerPromptDescriptor,
      retries: 1,
    });
    await expect(
      planner.plan({
        ...createReviewCaseFixture(),
        caseId: "case_retry",
        policyVersion: "policy-v1",
      }),
    ).resolves.toMatchObject({ planningReason: "需要核对产品声明。" });
    expect(retryModel.calls).toBe(2);

    const timeoutPlanner = new LLMReviewPlanner({
      model: new FakeStructuredModel([new Error("provider timeout")]),
      prompt: plannerPromptDescriptor,
      retries: 0,
    });
    await expect(
      timeoutPlanner.plan({
        ...createReviewCaseFixture(),
        caseId: "case_timeout",
        policyVersion: "policy-v1",
      }),
    ).rejects.toMatchObject({
      failure: expect.objectContaining({ code: "TIMEOUT" }),
    });
  });
});
