import { z } from "zod";
import {
  EvidenceItemSchema,
  IsoTimestampSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  PositiveVersionSchema,
  ReviewActionSchema,
  ReviewActorSchema,
  ReviewCaseSchema,
  ReviewEngineOutputSchema,
} from "../../algorithm/index.js";

export const ReviewCaseRecordSchema = z.strictObject({
  case: ReviewCaseSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type ReviewCaseRecord = z.infer<typeof ReviewCaseRecordSchema>;

export const ContentVersionRecordSchema = z.strictObject({
  versionId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  content: z.string(),
  imageUrls: z.array(z.string()),
  targetPlatform: z.array(z.string()),
  createdBy: ReviewActorSchema,
  createdAt: IsoTimestampSchema,
});
export type ContentVersionRecord = z.infer<typeof ContentVersionRecordSchema>;

export const StoredReviewResultSchema = z.strictObject({
  resultId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  executionId: NonBlankIdSchema,
  output: ReviewEngineOutputSchema,
  createdAt: IsoTimestampSchema,
});
export type StoredReviewResult = z.infer<typeof StoredReviewResultSchema>;

export const EvidenceSnapshotSchema = z.strictObject({
  snapshotId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  executionId: NonBlankIdSchema,
  knowledgeVersion: NonBlankStringSchema.nullable(),
  socialContextVersion: NonBlankStringSchema.nullable(),
  evidenceItems: z.array(EvidenceItemSchema),
  createdAt: IsoTimestampSchema,
});
export type EvidenceSnapshot = z.infer<typeof EvidenceSnapshotSchema>;

export const ReviewActionRecordSchema = z.strictObject({
  actionId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  action: ReviewActionSchema,
  createdAt: IsoTimestampSchema,
});
export type ReviewActionRecord = z.infer<typeof ReviewActionRecordSchema>;

export const RevisionTransactionInputSchema = z.strictObject({
  caseId: NonBlankIdSchema,
  expectedVersion: PositiveVersionSchema,
  revisedContent: NonBlankStringSchema,
  actor: ReviewActorSchema,
  reason: NonBlankStringSchema,
  timestamp: IsoTimestampSchema,
});
export type RevisionTransactionInput = z.infer<
  typeof RevisionTransactionInputSchema
>;

export const RevisionTransactionResultSchema = z.strictObject({
  case: ReviewCaseSchema,
  version: ContentVersionRecordSchema,
  action: ReviewActionRecordSchema,
});
export type RevisionTransactionResult = z.infer<
  typeof RevisionTransactionResultSchema
>;
