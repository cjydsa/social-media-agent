import type { z } from "zod";
import {
  DimensionReviewResultSchema,
  EvidenceCriticResultSchema,
  FinalReviewDecisionSchema,
  JudgeRecommendationSchema,
  ReviewPlanSchema,
  RevisionProposalSchema,
  type DimensionReviewResult,
  type EvidenceCriticResult,
  type FinalReviewDecision,
  type JudgeRecommendation,
  type ReviewPlan,
  type RevisionProposal,
} from "../schemas/multi-agent.js";
import type { ReviewDimension } from "../schemas/multi-agent.js";
import type { ReviewEngineInput } from "../schemas/review-engine.js";
import type { PromptDescriptor } from "./schemas.js";
import {
  invokeStructuredOutput,
  type StructuredOutputModel,
} from "./structured-output.js";

interface BaseAgentOptions {
  model: StructuredOutputModel;
  prompt: PromptDescriptor;
  retries?: number;
}

async function invokeAgent<T>(
  schema: z.ZodType<T>,
  options: BaseAgentOptions,
  payload: unknown,
): Promise<T> {
  return invokeStructuredOutput({
    model: options.model,
    schema,
    retries: options.retries,
    input: {
      promptVersion: options.prompt.promptVersion,
      role: options.prompt.role,
      evidenceRules: options.prompt.evidenceRules,
      forbiddenBehavior: options.prompt.forbiddenBehavior,
      payload,
    },
  });
}

export class LLMReviewPlanner {
  constructor(private readonly options: BaseAgentOptions) {}

  async plan(input: ReviewEngineInput): Promise<ReviewPlan> {
    return invokeAgent(ReviewPlanSchema, this.options, input);
  }
}

export class LLMDimensionReviewer {
  constructor(
    private readonly options: BaseAgentOptions & {
      dimension: ReviewDimension;
    },
  ) {}

  async review(input: unknown): Promise<DimensionReviewResult> {
    return invokeAgent(DimensionReviewResultSchema, this.options, {
      dimension: this.options.dimension,
      input,
    });
  }
}

export class LLMEvidenceCritic {
  constructor(private readonly options: BaseAgentOptions) {}

  async critique(input: unknown): Promise<EvidenceCriticResult> {
    return invokeAgent(EvidenceCriticResultSchema, this.options, input);
  }
}

export class LLMDecisionJudge {
  constructor(private readonly options: BaseAgentOptions) {}

  async judge(input: unknown): Promise<JudgeRecommendation> {
    return invokeAgent(JudgeRecommendationSchema, this.options, input);
  }
}

export class LLMRevisionAgent {
  constructor(private readonly options: BaseAgentOptions) {}

  async revise(input: unknown): Promise<RevisionProposal> {
    return invokeAgent(RevisionProposalSchema, this.options, input);
  }
}

export class LLMFinalDecisionReader {
  constructor(private readonly options: BaseAgentOptions) {}

  async read(input: unknown): Promise<FinalReviewDecision> {
    return invokeAgent(FinalReviewDecisionSchema, this.options, input);
  }
}
