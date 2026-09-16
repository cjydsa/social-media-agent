import { calculateBenchmarkMetrics } from "./metrics/index.js";
import { loadBenchmarkCases, loadBenchmarkManifest } from "./loader.js";
import { BenchmarkCaseSchema } from "./schemas.js";
import type { BenchmarkCase, BenchmarkManifest } from "./schemas.js";

export interface BenchmarkValidationResult {
  valid: boolean;
  errors: string[];
  manifest: BenchmarkManifest;
  caseCount: number;
}

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function validateDuplicateIds(
  cases: readonly BenchmarkCase[],
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const benchmarkCase of cases) {
    if (seen.has(benchmarkCase.id)) {
      errors.push(`Duplicate benchmark case id: ${benchmarkCase.id}`);
    }
    seen.add(benchmarkCase.id);
  }
}

function validateSplitLeakage(
  cases: readonly BenchmarkCase[],
  errors: string[],
): void {
  const devContents = new Set(
    cases
      .filter((benchmarkCase) => benchmarkCase.split === "dev")
      .map((benchmarkCase) => normalizeContent(benchmarkCase.content)),
  );
  for (const benchmarkCase of cases.filter(
    (candidate) => candidate.split === "test",
  )) {
    if (devContents.has(normalizeContent(benchmarkCase.content))) {
      errors.push(`Split leakage detected for case: ${benchmarkCase.id}`);
    }
  }
}

function validateLabels(
  cases: readonly BenchmarkCase[],
  errors: string[],
): void {
  for (const benchmarkCase of cases) {
    if (
      benchmarkCase.expectedDecision !== "PASS" &&
      benchmarkCase.expectedDimensions.length === 0
    ) {
      errors.push(`Risk case has no expectedDimensions: ${benchmarkCase.id}`);
    }
    if (
      benchmarkCase.expectedDecision === "PASS" &&
      benchmarkCase.expectedSeverity !== "LOW"
    ) {
      errors.push(
        `PASS case must use LOW expectedSeverity: ${benchmarkCase.id}`,
      );
    }
    if (!benchmarkCase.provenance) {
      errors.push(`Missing provenance: ${benchmarkCase.id}`);
    }
  }
}

function validateManifest(
  cases: readonly BenchmarkCase[],
  manifest: BenchmarkManifest,
  errors: string[],
): void {
  if (manifest.caseCount !== cases.length) {
    errors.push(
      `Manifest caseCount ${manifest.caseCount} does not match ${cases.length}.`,
    );
  }
  const devCount = cases.filter(
    (benchmarkCase) => benchmarkCase.split === "dev",
  ).length;
  const testCount = cases.length - devCount;
  if (
    manifest.splitCounts.dev !== devCount ||
    manifest.splitCounts.test !== testCount
  ) {
    errors.push("Manifest splitCounts do not match dataset.");
  }
  const syntheticCount = cases.filter(
    (benchmarkCase) => benchmarkCase.provenance === "synthetic",
  ).length;
  if (manifest.provenanceCounts.synthetic !== syntheticCount) {
    errors.push("Manifest provenanceCounts do not match dataset.");
  }
}

function validateMetricToyCase(errors: string[]): void {
  const metrics = calculateBenchmarkMetrics([
    {
      caseId: "toy_1",
      expectedDecision: "BLOCK",
      actualDecision: "BLOCK",
      expectedDimensions: ["COMPLIANCE_SAFETY"],
      actualDimensions: ["COMPLIANCE_SAFETY"],
      expectedSeverity: "HIGH",
      actualMaxSeverity: "HIGH",
      requiredEvidence: ["PLATFORM_POLICY"],
      citedEvidence: ["PLATFORM_POLICY"],
      schemaParseSuccess: true,
      latencyMs: 10,
      inputTokens: 20,
      outputTokens: 10,
      estimatedCost: 0.01,
    },
    {
      caseId: "toy_2",
      expectedDecision: "PASS",
      actualDecision: "PASS",
      expectedDimensions: [],
      actualDimensions: [],
      expectedSeverity: "LOW",
      actualMaxSeverity: "LOW",
      requiredEvidence: [],
      citedEvidence: [],
      schemaParseSuccess: true,
      latencyMs: 20,
      inputTokens: 10,
      outputTokens: 5,
      estimatedCost: null,
    },
  ]);
  if (metrics.decisionAccuracy !== 1 || metrics.highRiskFalsePassRate !== 0) {
    errors.push("Metric toy case produced unexpected result.");
  }
}

export function validateBenchmarkDatasetInput(
  cases: readonly BenchmarkCase[],
  manifest: BenchmarkManifest,
): BenchmarkValidationResult {
  const errors: string[] = [];

  for (const benchmarkCase of cases) {
    const parsed = BenchmarkCaseSchema.safeParse(benchmarkCase);
    if (!parsed.success) {
      errors.push(`Schema validation failed for case ${benchmarkCase.id}.`);
    }
  }

  validateDuplicateIds(cases, errors);
  validateSplitLeakage(cases, errors);
  validateLabels(cases, errors);
  validateManifest(cases, manifest, errors);
  validateMetricToyCase(errors);

  return {
    valid: errors.length === 0,
    errors,
    manifest,
    caseCount: cases.length,
  };
}

export function validateBenchmarkDataset(): BenchmarkValidationResult {
  return validateBenchmarkDatasetInput(
    loadBenchmarkCases(),
    loadBenchmarkManifest(),
  );
}

export function runEvaluationValidation(): BenchmarkValidationResult {
  const result = validateBenchmarkDataset();
  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
  return result;
}
