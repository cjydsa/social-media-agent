import { z } from "zod";
import type { SocialContextProvider } from "../ports/social-context.js";
import type { EvidenceProvider } from "../ports/evidence-provider.js";
import {
  ContentTypeSchema,
  IsoTimestampSchema,
  JsonValueSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  PositiveVersionSchema,
  ReviewStageSchema,
} from "./common.js";
import { ReviewResultSchema } from "./review-result.js";
import {
  EvidenceCriticResultSchema,
  FinalReviewDecisionSchema,
  JudgeRecommendationSchema,
  ReviewPlanSchema,
} from "./multi-agent.js";

export const ReviewFailureCodeSchema = z.enum([
  "INVALID_INPUT",
  "SCHEMA_VALIDATION_FAILED",
  "DEPENDENCY_UNAVAILABLE",
  "TIMEOUT",
  "CANCELLED",
  "REVIEWER_FAILED",
  "INTERNAL_ERROR",
]);
export type ReviewFailureCode = z.infer<typeof ReviewFailureCodeSchema>;

export const ReviewFailureSourceSchema = z.enum([
  "INPUT",
  "REVIEW_ENGINE",
  "RULE",
  "MODEL",
  "RETRIEVAL",
  "VISUAL",
  "SOCIAL_CONTEXT",
  "POLICY",
]);
export type ReviewFailureSource = z.infer<typeof ReviewFailureSourceSchema>;

export const ReviewFailureSchema = z.strictObject({
  code: ReviewFailureCodeSchema,
  message: NonBlankStringSchema,
  retryable: z.boolean(),
  source: ReviewFailureSourceSchema,
  details: z.record(z.string(), JsonValueSchema).nullable(),
});
export type ReviewFailure = z.infer<typeof ReviewFailureSchema>;

export const ExecutionReferenceSchema = z.strictObject({
  executionId: NonBlankIdSchema,
  threadId: NonBlankIdSchema,
  runId: NonBlankIdSchema.nullable(),
});
export type ExecutionReference = z.infer<typeof ExecutionReferenceSchema>;

export const HumanReviewActionSchema = z.enum([
  "APPROVE",
  "REVISE",
  "REJECT",
  "ESCALATE",
]);
export type HumanReviewAction = z.infer<typeof HumanReviewActionSchema>;

export const InterruptDescriptorSchema = z.strictObject({
  type: z.literal("HUMAN_REVIEW"),
  stage: ReviewStageSchema,
  allowedActions: z.array(HumanReviewActionSchema),
  reason: NonBlankStringSchema,
  requiredRole: NonBlankStringSchema,
});
export type InterruptDescriptor = z.infer<typeof InterruptDescriptorSchema>;

export const ReviewEngineInputSchema = z.strictObject({
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  contentType: ContentTypeSchema,
  targetPlatform: z.array(z.string()),
  currentContent: z.string(),
  imageUrls: z.array(z.string()),
  currentStage: ReviewStageSchema,
  policyVersion: NonBlankIdSchema,
  originalContent: z.string().optional(),
});
export type ReviewEngineInput = z.infer<typeof ReviewEngineInputSchema>;

export const CancellationSignalSchema = z.custom<{
  readonly aborted: boolean;
  throwIfAborted(): void;
}>((value) => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    aborted?: unknown;
    throwIfAborted?: unknown;
  };
  return (
    typeof candidate.aborted === "boolean" &&
    typeof candidate.throwIfAborted === "function"
  );
}, "Invalid cancellation capability.");
export type CancellationSignal = z.infer<typeof CancellationSignalSchema>;

const SocialContextProviderCapabilitySchema = z.custom<SocialContextProvider>(
  (value) => {
    if (typeof value !== "object" || value === null) return false;
    return (
      typeof (value as { getSnapshot?: unknown }).getSnapshot === "function"
    );
  },
  "Invalid SocialContextProvider capability.",
);

const EvidenceProviderCapabilitySchema = z.custom<EvidenceProvider>((value) => {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as { retrieve?: unknown }).retrieve === "function";
}, "Invalid EvidenceProvider capability.");

const TraceMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const ReviewContextSchema = z.strictObject({
  requestId: NonBlankIdSchema,
  deadlineAt: IsoTimestampSchema.nullable(),
  traceMetadata: z.record(z.string(), TraceMetadataValueSchema),
  cancellation: CancellationSignalSchema.nullable(),
  dependencies: z.strictObject({
    socialContextProvider: SocialContextProviderCapabilitySchema.nullable(),
    brandKnowledgeProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    historicalPrCasesProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    platformPolicyProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    campaignBriefProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    accountProfileProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    productKnowledgeProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    approvedClaimsProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    customerFaqProvider: EvidenceProviderCapabilitySchema.nullable().optional(),
    servicePolicyProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
    multimodalEvidenceProvider:
      EvidenceProviderCapabilitySchema.nullable().optional(),
  }),
});
export type ReviewContext = z.infer<typeof ReviewContextSchema>;

export const ResumeActorSchema = z.strictObject({
  id: NonBlankIdSchema,
  displayName: z.string(),
  role: NonBlankStringSchema,
});
export type ResumeActor = z.infer<typeof ResumeActorSchema>;

const ResumeBaseShape = {
  executionId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  actor: ResumeActorSchema,
  reason: NonBlankStringSchema,
};

export const ResumeReviewInputSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...ResumeBaseShape,
    action: z.literal("REVISE"),
    revisedContent: NonBlankStringSchema,
  }),
  z.strictObject({
    ...ResumeBaseShape,
    action: z.literal("APPROVE"),
    revisedContent: z.null(),
  }),
  z.strictObject({
    ...ResumeBaseShape,
    action: z.literal("REJECT"),
    revisedContent: z.null(),
  }),
  z.strictObject({
    ...ResumeBaseShape,
    action: z.literal("ESCALATE"),
    revisedContent: z.null(),
  }),
]);
export type ResumeReviewInput = z.infer<typeof ResumeReviewInputSchema>;

export const ReviewEngineOutputSchema = z.strictObject({
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  results: z.array(ReviewResultSchema),
  aggregateResult: ReviewResultSchema.nullable(),
  nextStage: ReviewStageSchema,
  requiresHuman: z.boolean(),
  interrupt: InterruptDescriptorSchema.nullable(),
  execution: ExecutionReferenceSchema,
  failures: z.array(ReviewFailureSchema),
  reviewPlan: ReviewPlanSchema.optional(),
  evidenceCriticResult: EvidenceCriticResultSchema.optional(),
  judgeRecommendation: JudgeRecommendationSchema.optional(),
  finalDecision: FinalReviewDecisionSchema.optional(),
});
export type ReviewEngineOutput = z.infer<typeof ReviewEngineOutputSchema>;
