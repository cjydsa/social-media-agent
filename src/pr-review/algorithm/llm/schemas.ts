import { z } from "zod";
import {
  IsoTimestampSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  NonNegativeIntegerSchema,
  PositiveVersionSchema,
} from "../schemas/common.js";
import { ReviewDimensionSchema } from "../schemas/multi-agent.js";

export const ReviewExecutionModeSchema = z.enum(["mock", "hybrid", "real"]);
export type ReviewExecutionMode = z.infer<typeof ReviewExecutionModeSchema>;

export const ReviewModelProviderSchema = z.enum([
  "mock",
  "deepseek",
  "qwen",
  "openai",
  "anthropic",
]);
export type ReviewModelProvider = z.infer<typeof ReviewModelProviderSchema>;

export const ReviewAgentRoleSchema = z.enum([
  "planner",
  "specialist",
  "critic",
  "judge",
  "revision",
]);
export type ReviewAgentRole = z.infer<typeof ReviewAgentRoleSchema>;

export const RoleModelSelectionSchema = z.strictObject({
  provider: ReviewModelProviderSchema,
  model: z.string().nullable(),
});
export type RoleModelSelection = z.infer<typeof RoleModelSelectionSchema>;

export const RoleModelPolicySchema = z.strictObject({
  executionMode: ReviewExecutionModeSchema,
  planner: RoleModelSelectionSchema,
  specialist: RoleModelSelectionSchema,
  critic: RoleModelSelectionSchema,
  judge: RoleModelSelectionSchema,
  revision: RoleModelSelectionSchema,
});
export type RoleModelPolicy = z.infer<typeof RoleModelPolicySchema>;

export const PromptDescriptorSchema = z.strictObject({
  promptVersion: NonBlankStringSchema,
  role: ReviewAgentRoleSchema,
  inputContract: NonBlankStringSchema,
  outputContract: NonBlankStringSchema,
  evidenceRules: z.array(NonBlankStringSchema),
  forbiddenBehavior: z.array(NonBlankStringSchema),
});
export type PromptDescriptor = z.infer<typeof PromptDescriptorSchema>;

export const LLMAgentTraceMetadataSchema = z.strictObject({
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  executionId: NonBlankIdSchema,
  agentRole: ReviewAgentRoleSchema,
  dimension: ReviewDimensionSchema.nullable(),
  provider: ReviewModelProviderSchema,
  model: z.string().nullable(),
  promptVersion: NonBlankStringSchema,
  knowledgeVersion: z.string().nullable(),
  latencyMs: z.number().min(0),
  inputTokens: NonNegativeIntegerSchema,
  outputTokens: NonNegativeIntegerSchema,
  createdAt: IsoTimestampSchema.optional(),
});
export type LLMAgentTraceMetadata = z.infer<typeof LLMAgentTraceMetadataSchema>;
