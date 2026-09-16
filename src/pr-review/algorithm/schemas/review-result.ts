import { z } from "zod";
import {
  IssueCategorySchema,
  NonBlankIdSchema,
  ReviewerTypeSchema,
  ReviewDecisionSchema,
  RiskLevelSchema,
  SeveritySchema,
  UnitIntervalSchema,
} from "./common.js";

export const TextSpanSchema = z
  .strictObject({
    start: z.number().int().min(0),
    end: z.number().int(),
    quote: z.string(),
  })
  .refine(({ start, end }) => end > start, {
    message: "textSpan.end must be greater than textSpan.start.",
    path: ["end"],
  });
export type TextSpan = z.infer<typeof TextSpanSchema>;

export const ReviewIssueSchema = z.strictObject({
  id: NonBlankIdSchema,
  category: IssueCategorySchema,
  severity: SeveritySchema,
  textSpan: TextSpanSchema.nullable(),
  reason: z.string(),
  evidenceIds: z.array(NonBlankIdSchema),
  suggestion: z.string().nullable(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  "SUBMITTED_SOURCE",
  "BRAND_KNOWLEDGE",
  "RULE",
  "WEB",
  "IMAGE",
  "OCR",
  "HUMAN",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceItemSchema = z.strictObject({
  id: NonBlankIdSchema,
  sourceType: EvidenceSourceTypeSchema,
  title: z.string(),
  content: z.string(),
  source: z.string(),
  score: UnitIntervalSchema.nullable(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ModelUsageSchema = z.strictObject({
  model: z.string().nullable(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCost: z.number().min(0).nullable(),
  currency: z.string().nullable(),
});
export type ModelUsage = z.infer<typeof ModelUsageSchema>;

export const ReviewResultSchema = z.strictObject({
  decision: ReviewDecisionSchema,
  riskLevel: RiskLevelSchema,
  confidence: UnitIntervalSchema,
  issues: z.array(ReviewIssueSchema),
  evidence: z.array(EvidenceItemSchema),
  suggestedRevision: z.string().nullable(),
  reviewerType: ReviewerTypeSchema,
  reviewerName: z.string(),
  latencyMs: z.number().min(0),
  modelUsage: ModelUsageSchema,
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
