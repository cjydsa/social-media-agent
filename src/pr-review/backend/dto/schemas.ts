import { z } from "zod";
import {
  ContentTypeSchema,
  JsonValueSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  PositiveVersionSchema,
  ReviewActionSchema,
  ReviewActorSchema,
  ReviewCaseSchema,
  ReviewEngineOutputSchema,
} from "../../algorithm/index.js";
import {
  ContentVersionRecordSchema,
  EvidenceSnapshotSchema,
  ReviewActionRecordSchema,
  StoredReviewResultSchema,
} from "../repositories/schemas.js";
import { ReviewActionTypeSchema } from "../../algorithm/schemas/common.js";

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "UNSUPPORTED_MEDIA_TYPE",
  "PAYLOAD_TOO_LARGE",
  "METHOD_NOT_ALLOWED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_STAGE_ACTION",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: NonBlankStringSchema,
    details: z.record(z.string(), JsonValueSchema).nullable(),
    requestId: NonBlankIdSchema.nullable(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export const PageInfoSchema = z.strictObject({
  nextCursor: z.string().nullable(),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export const PaginationQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().nullable().default(null),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const CreateReviewRequestSchema = z.strictObject({
  contentType: ContentTypeSchema,
  targetPlatform: z.array(NonBlankStringSchema).min(1),
  content: NonBlankStringSchema,
  imageUrls: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string()).default([]),
});
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;

export const ReviewDetailResponseSchema = z.strictObject({
  case: ReviewCaseSchema,
  latestResult: ReviewEngineOutputSchema.nullable(),
  allowedActions: z.array(ReviewActionTypeSchema),
});
export type ReviewDetailResponse = z.infer<typeof ReviewDetailResponseSchema>;

export const ReviewListResponseSchema = z.strictObject({
  data: z.array(ReviewCaseSchema),
  page: PageInfoSchema,
});
export type ReviewListResponse = z.infer<typeof ReviewListResponseSchema>;

export const ReviewActionRequestSchema = z.strictObject({
  expectedVersion: PositiveVersionSchema,
  actor: ReviewActorSchema,
  reason: NonBlankStringSchema,
});
export type ReviewActionRequest = z.infer<typeof ReviewActionRequestSchema>;

export const ReviseReviewRequestSchema = ReviewActionRequestSchema.extend({
  revisedContent: NonBlankStringSchema,
}).strict();
export type ReviseReviewRequest = z.infer<typeof ReviseReviewRequestSchema>;

export const EscalateReviewRequestSchema = ReviewActionRequestSchema.extend({
  escalationTarget: NonBlankStringSchema.nullable(),
}).strict();
export type EscalateReviewRequest = z.infer<typeof EscalateReviewRequestSchema>;

export const ReviewActionResponseSchema = z.strictObject({
  case: ReviewCaseSchema,
  action: ReviewActionSchema,
});
export type ReviewActionResponse = z.infer<typeof ReviewActionResponseSchema>;

export const ReviewHistoryResponseSchema = z.strictObject({
  case: ReviewCaseSchema,
  versions: z.array(ContentVersionRecordSchema),
  actions: z.array(ReviewActionRecordSchema),
  results: z.array(StoredReviewResultSchema),
  evidenceSnapshots: z.array(EvidenceSnapshotSchema),
});
export type ReviewHistoryResponse = z.infer<typeof ReviewHistoryResponseSchema>;

export const EvaluationLatestResponseSchema = z.strictObject({
  latestRun: z.unknown().nullable(),
});
export type EvaluationLatestResponse = z.infer<
  typeof EvaluationLatestResponseSchema
>;

export const UploadMediaTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
export type UploadMediaType = z.infer<typeof UploadMediaTypeSchema>;

export const UploadFileInputSchema = z.strictObject({
  fileName: NonBlankStringSchema,
  mediaType: UploadMediaTypeSchema,
  dataBase64: z.string().min(1),
});
export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

export const UploadFilesRequestSchema = z.strictObject({
  files: z.array(UploadFileInputSchema).min(1).max(5),
});
export type UploadFilesRequest = z.infer<typeof UploadFilesRequestSchema>;

export const UploadedFileSchema = z.strictObject({
  url: NonBlankStringSchema,
  fileName: NonBlankStringSchema,
  size: z.number().int().nonnegative(),
  mediaType: z.string(),
});
export type UploadedFile = z.infer<typeof UploadedFileSchema>;

export const UploadFilesResponseSchema = z.strictObject({
  data: z.strictObject({
    files: z.array(UploadedFileSchema),
  }),
});
export type UploadFilesResponse = z.infer<typeof UploadFilesResponseSchema>;

export const ScheduleReviewRequestSchema = z.strictObject({
  expectedVersion: PositiveVersionSchema,
  reason: NonBlankStringSchema,
});
export type ScheduleReviewRequest = z.infer<typeof ScheduleReviewRequestSchema>;

export const PublishReceiptSchema = z.strictObject({
  receiptId: NonBlankIdSchema,
  caseId: NonBlankIdSchema,
  version: PositiveVersionSchema,
  scheduledAt: z.string(),
  mode: z.literal("mock"),
  note: z.string(),
});
export type PublishReceipt = z.infer<typeof PublishReceiptSchema>;

export const ScheduleReviewResponseSchema = z.strictObject({
  data: z.strictObject({
    case: ReviewCaseSchema,
    action: ReviewActionSchema,
    receipt: PublishReceiptSchema,
  }),
});
export type ScheduleReviewResponse = z.infer<
  typeof ScheduleReviewResponseSchema
>;
