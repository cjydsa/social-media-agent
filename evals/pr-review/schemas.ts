import { z } from "zod";
import {
  ContentTypeSchema,
  FinalDecisionSchema,
  IsoTimestampSchema,
  IssueCategorySchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  ReviewDimensionSchema,
  SeveritySchema,
} from "../../src/pr-review/algorithm/index.js";

export const BenchmarkSplitSchema = z.enum(["dev", "test"]);
export type BenchmarkSplit = z.infer<typeof BenchmarkSplitSchema>;

export const BenchmarkProvenanceSchema = z.enum([
  "synthetic",
  "manually_curated",
  "authorized_export",
]);
export type BenchmarkProvenance = z.infer<typeof BenchmarkProvenanceSchema>;

export const BenchmarkCaseSchema = z.strictObject({
  id: NonBlankIdSchema,
  content: NonBlankStringSchema,
  contentType: ContentTypeSchema,
  platform: z.array(NonBlankStringSchema),
  expectedDecision: FinalDecisionSchema,
  expectedDimensions: z.array(ReviewDimensionSchema),
  expectedIssues: z.array(IssueCategorySchema),
  expectedSeverity: SeveritySchema,
  requiredEvidence: z.array(NonBlankStringSchema),
  provenance: BenchmarkProvenanceSchema,
  notes: NonBlankStringSchema,
  split: BenchmarkSplitSchema,
});
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export const BenchmarkManifestSchema = z.strictObject({
  datasetVersion: NonBlankStringSchema,
  createdAt: IsoTimestampSchema,
  caseCount: z.number().int().min(0),
  splitCounts: z.record(BenchmarkSplitSchema, z.number().int().min(0)),
  provenanceCounts: z.record(
    BenchmarkProvenanceSchema,
    z.number().int().min(0),
  ),
});
export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;

export const BenchmarkRunCaseResultSchema = z.strictObject({
  caseId: NonBlankIdSchema,
  expectedDecision: FinalDecisionSchema,
  actualDecision: FinalDecisionSchema,
  expectedDimensions: z.array(ReviewDimensionSchema),
  actualDimensions: z.array(ReviewDimensionSchema),
  expectedSeverity: SeveritySchema,
  actualMaxSeverity: SeveritySchema.nullable(),
  requiredEvidence: z.array(NonBlankStringSchema),
  citedEvidence: z.array(NonBlankStringSchema),
  schemaParseSuccess: z.boolean(),
  latencyMs: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCost: z.number().min(0).nullable(),
});
export type BenchmarkRunCaseResult = z.infer<
  typeof BenchmarkRunCaseResultSchema
>;

export const BenchmarkMetricsSchema = z.strictObject({
  dimensionPrecision: z.number().min(0).max(1),
  dimensionRecall: z.number().min(0).max(1),
  dimensionF1: z.number().min(0).max(1),
  macroF1: z.number().min(0).max(1),
  highRiskRecall: z.number().min(0).max(1),
  highRiskFalsePassRate: z.number().min(0).max(1),
  decisionAccuracy: z.number().min(0).max(1),
  manualReviewRate: z.number().min(0).max(1),
  evidenceCoverage: z.number().min(0).max(1),
  evidenceCitationPrecision: z.number().min(0).max(1),
  schemaParseSuccessRate: z.number().min(0).max(1),
  averageLatencyMs: z.number().min(0),
  p95LatencyMs: z.number().min(0),
  averageInputTokens: z.number().min(0),
  averageOutputTokens: z.number().min(0),
  averageCostPerCase: z.number().min(0).nullable(),
});
export type BenchmarkMetrics = z.infer<typeof BenchmarkMetricsSchema>;

export const BenchmarkRunSummarySchema = z.strictObject({
  runId: NonBlankIdSchema,
  datasetVersion: NonBlankStringSchema,
  algorithmVersion: NonBlankStringSchema,
  executionMode: z.enum(["mock", "hybrid", "real"]),
  sampleCount: z.number().int().min(0),
  metrics: BenchmarkMetricsSchema.nullable(),
  createdAt: IsoTimestampSchema,
});
export type BenchmarkRunSummary = z.infer<typeof BenchmarkRunSummarySchema>;
