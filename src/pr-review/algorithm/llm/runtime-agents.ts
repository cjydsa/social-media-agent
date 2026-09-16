import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { LLMConfig } from "../../config/types.js";
import type {
  DimensionReviewResult,
  EvidenceCoverage,
  EvidenceCriticResult,
  JudgeRecommendation,
  ReviewDimension,
  ReviewPlan,
  RevisionProposal,
} from "../schemas/multi-agent.js";
import {
  DimensionReviewResultSchema,
  EvidenceCriticResultSchema,
  JudgeRecommendationSchema,
  ReviewPlanSchema,
  RevisionProposalSchema,
} from "../schemas/multi-agent.js";
import type { EvidenceItem } from "../schemas/review-result.js";
import type { ReviewEngineInput } from "../schemas/review-engine.js";
import { createReviewModel } from "../providers/index.js";
import {
  criticPromptV2Descriptor,
  judgePromptV2Descriptor,
  plannerPromptV2Descriptor,
  revisionPromptV2Descriptor,
  specialistPromptV2Descriptor,
} from "../prompts/descriptors.js";
import type { PromptDescriptor } from "./schemas.js";
import { invokeStructuredOutput } from "./structured-output.js";

/** Graph-facing async agent ports (contracts 12.8.1). */
export interface ReviewAgentSet {
  plan(input: ReviewEngineInput): Promise<ReviewPlan>;
  reviewDimension(payload: {
    dimension: ReviewDimension;
    input: ReviewEngineInput;
    plan: ReviewPlan;
    evidence: EvidenceItem[];
  }): Promise<DimensionReviewResult>;
  critique(payload: {
    input: ReviewEngineInput;
    results: DimensionReviewResult[];
    coverage: EvidenceCoverage;
  }): Promise<EvidenceCriticResult>;
  judge(payload: {
    input: ReviewEngineInput;
    results: DimensionReviewResult[];
    critic: EvidenceCriticResult;
  }): Promise<JudgeRecommendation>;
  revise(payload: {
    input: ReviewEngineInput;
    results: DimensionReviewResult[];
    judge: JudgeRecommendation;
  }): Promise<RevisionProposal>;
}

export type AgentRoleLLMConfig = Readonly<
  Record<"planner" | "specialist" | "critic" | "judge" | "revision", LLMConfig>
>;

export interface RuntimeAgentOptions {
  roleLLM: AgentRoleLLMConfig;
  retries?: number;
  /** Override prompt texts (tests); defaults load from prompts/**. */
  promptOverrides?: Partial<Record<string, string>>;
}

const PROMPT_FILES = {
  planner: "../prompts/planner/planner-v2.md",
  specialist: "../prompts/specialist/specialist-v2.md",
  critic: "../prompts/critic/critic-v2.md",
  judge: "../prompts/judge/judge-v2.md",
  revision: "../prompts/revision/revision-v2.md",
} as const;

function loadPrompt(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function simplifyEvidence(evidence: EvidenceItem[]) {
  return evidence.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    content: item.content,
  }));
}

/**
 * Builds the LLM-backed ReviewAgentSet from per-role typed configs.
 * Models are constructed only through the provider factory; this module
 * never reads env or secrets directly.
 */
export function createRuntimeAgents(
  options: RuntimeAgentOptions,
): ReviewAgentSet {
  const instructions = new Map<string, string>();
  const instructionFor = (role: keyof typeof PROMPT_FILES): string => {
    const override = options.promptOverrides?.[role];
    if (override) return override;
    if (!instructions.has(role)) {
      instructions.set(role, loadPrompt(PROMPT_FILES[role]));
    }
    return instructions.get(role)!;
  };

  const modelFor = (role: keyof AgentRoleLLMConfig) =>
    createReviewModel(options.roleLLM[role]);

  const invoke = <T>(
    role: keyof AgentRoleLLMConfig,
    descriptor: PromptDescriptor,
    schema: Parameters<typeof invokeStructuredOutput<T>>[0]["schema"],
    payload: unknown,
  ): Promise<T> =>
    invokeStructuredOutput<T>({
      model: modelFor(role),
      schema,
      retries: options.retries ?? 1,
      input: {
        promptVersion: descriptor.promptVersion,
        role: descriptor.role,
        instruction: instructionFor(role),
        evidenceRules: descriptor.evidenceRules,
        forbiddenBehavior: descriptor.forbiddenBehavior,
        payload,
      },
    });

  return {
    plan(input) {
      return invoke("planner", plannerPromptV2Descriptor, ReviewPlanSchema, {
        contentType: input.contentType,
        targetPlatform: input.targetPlatform,
        content: input.currentContent,
        hasImages: input.imageUrls.length > 0,
      });
    },

    async reviewDimension({ dimension, input, plan, evidence }) {
      const result = await invoke(
        "specialist",
        specialistPromptV2Descriptor,
        DimensionReviewResultSchema,
        {
          dimension,
          contentType: input.contentType,
          targetPlatform: input.targetPlatform,
          content: input.currentContent,
          imageEvidence: simplifyEvidence(
            evidence.filter(
              (item) => item.sourceType === "IMAGE" || item.sourceType === "OCR",
            ),
          ),
          evidence: simplifyEvidence(
            evidence.filter(
              (item) => item.sourceType !== "IMAGE" && item.sourceType !== "OCR",
            ),
          ),
          depth: plan.reviewDepthByDimension[dimension] ?? "LIGHT",
        },
      );
      // The assigned dimension is authoritative; never trust model drift.
      return { ...result, dimension };
    },

    critique({ results, coverage }) {
      return invoke("critic", criticPromptV2Descriptor, EvidenceCriticResultSchema, {
        results,
        coverage,
      });
    },

    judge({ results, critic }) {
      return invoke("judge", judgePromptV2Descriptor, JudgeRecommendationSchema, {
        results,
        critic,
      });
    },

    revise({ input, results, judge }) {
      return invoke("revision", revisionPromptV2Descriptor, RevisionProposalSchema, {
        content: input.currentContent,
        blockingIssues: results.flatMap((result) => result.issues),
        judge,
      });
    },
  };
}
