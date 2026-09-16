import { z } from "zod";
import {
  ContentTypeSchema,
  IsoTimestampSchema,
  NonBlankIdSchema,
  PositiveVersionSchema,
  ReviewStageSchema,
} from "./common.js";

export const ReviewSubmitterSchema = z.strictObject({
  id: NonBlankIdSchema,
  displayName: z.string(),
});
export type ReviewSubmitter = z.infer<typeof ReviewSubmitterSchema>;

export const ReviewCaseSchema = z.strictObject({
  id: NonBlankIdSchema,
  contentType: ContentTypeSchema,
  targetPlatform: z.array(z.string()),
  originalContent: z.string(),
  currentContent: z.string(),
  imageUrls: z.array(z.string()),
  submitter: ReviewSubmitterSchema,
  version: PositiveVersionSchema,
  currentStage: ReviewStageSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type ReviewCase = z.infer<typeof ReviewCaseSchema>;
