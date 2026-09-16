import { Annotation } from "@langchain/langgraph";
import { REVIEW_DIMENSIONS } from "../schemas/multi-agent.js";
import type {
  DimensionReviewResult,
  EvidenceCoverage,
  EvidenceCriticResult,
  FinalReviewDecision,
  JudgeRecommendation,
  ReviewPlan,
  RevisionProposal,
} from "../schemas/multi-agent.js";
import type {
  ExecutionReference,
  HumanReviewAction,
  InterruptDescriptor,
  ReviewEngineInput,
  ReviewFailure,
} from "../schemas/review-engine.js";
import type { EvidenceItem } from "../schemas/review-result.js";

const dimensionOrder = new Map(
  REVIEW_DIMENSIONS.map((dimension, index) => [dimension, index]),
);

export const ReviewStateAnnotation = Annotation.Root({
  input: Annotation<ReviewEngineInput>,
  contentSummary: Annotation<string | undefined>,
  plan: Annotation<ReviewPlan | undefined>,
  evidence: Annotation<EvidenceItem[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  evidenceCoverage: Annotation<EvidenceCoverage | undefined>,
  dimensionResults: Annotation<DimensionReviewResult[]>({
    reducer: (current, update) => {
      const byDimension = new Map(
        current.map((result) => [result.dimension, result]),
      );
      for (const result of update) byDimension.set(result.dimension, result);
      return [...byDimension.values()].sort(
        (left, right) =>
          (dimensionOrder.get(left.dimension) ?? 0) -
          (dimensionOrder.get(right.dimension) ?? 0),
      );
    },
    default: () => [],
  }),
  failures: Annotation<ReviewFailure[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  critic: Annotation<EvidenceCriticResult | undefined>,
  judge: Annotation<JudgeRecommendation | undefined>,
  finalDecision: Annotation<FinalReviewDecision | undefined>,
  revisionProposal: Annotation<RevisionProposal | undefined>,
  revisionCount: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),
  execution: Annotation<ExecutionReference>,
  pendingInterrupt: Annotation<InterruptDescriptor | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  humanAction: Annotation<HumanReviewAction | undefined>,
  terminalStage: Annotation<"COMPLETED" | "REJECTED" | "ESCALATED" | undefined>,
});

export type ReviewState = typeof ReviewStateAnnotation.State;
export type ReviewStateUpdate = typeof ReviewStateAnnotation.Update;
