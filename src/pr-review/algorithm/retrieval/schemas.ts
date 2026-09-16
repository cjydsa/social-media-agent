import { z } from "zod";
import {
  IsoTimestampSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  PositiveVersionSchema,
  UnitIntervalSchema,
} from "../schemas/common.js";
import { EvidenceItemSchema } from "../schemas/review-result.js";

export const KnowledgeSourceTypeSchema = z.enum([
  "PR",
  "BRAND",
  "PRODUCT",
  "CUSTOMER",
  "COMPLIANCE",
  "PLATFORM",
]);
export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;

export const KnowledgeDocumentSchema = z.strictObject({
  documentId: NonBlankIdSchema,
  sourceType: KnowledgeSourceTypeSchema,
  version: NonBlankStringSchema,
  effectiveAt: IsoTimestampSchema,
  title: NonBlankStringSchema,
  content: NonBlankStringSchema,
  tags: z.array(NonBlankStringSchema),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const KnowledgeRetrievalQuerySchema = z.strictObject({
  query: NonBlankStringSchema,
  sourceTypes: z.array(KnowledgeSourceTypeSchema),
  topK: PositiveVersionSchema,
});
export type KnowledgeRetrievalQuery = z.infer<
  typeof KnowledgeRetrievalQuerySchema
>;

export const RetrievedKnowledgeDocumentSchema = z.strictObject({
  document: KnowledgeDocumentSchema,
  bm25Score: z.number().min(0),
  vectorScore: z.number().min(0),
  rrfScore: z.number().min(0),
  evidence: EvidenceItemSchema,
});
export type RetrievedKnowledgeDocument = z.infer<
  typeof RetrievedKnowledgeDocumentSchema
>;

export const KnowledgeRetrievalResultSchema = z.strictObject({
  knowledgeVersion: NonBlankStringSchema,
  documents: z.array(RetrievedKnowledgeDocumentSchema),
});
export type KnowledgeRetrievalResult = z.infer<
  typeof KnowledgeRetrievalResultSchema
>;

export const RetrievalScoreSchema = UnitIntervalSchema;

export interface KnowledgeRetriever {
  retrieve(input: KnowledgeRetrievalQuery): Promise<KnowledgeRetrievalResult>;
}
