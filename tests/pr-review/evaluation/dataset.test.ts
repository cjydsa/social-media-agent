import { describe, expect, it } from "@jest/globals";
import {
  BenchmarkCaseSchema,
  loadBenchmarkCases,
  loadBenchmarkManifest,
  validateBenchmarkDataset,
  validateBenchmarkDatasetInput,
} from "../../../evals/pr-review/index.js";

describe("TEST-004 benchmark dataset", () => {
  it("loads Public Content Review Benchmark v1 with dev/test split", () => {
    const cases = loadBenchmarkCases();
    const manifest = loadBenchmarkManifest();

    expect(cases).toHaveLength(81);
    expect(loadBenchmarkCases({ split: "dev" })).toHaveLength(72);
    expect(loadBenchmarkCases({ split: "test" })).toHaveLength(9);
    expect(manifest.caseCount).toBe(81);
    expect(manifest.provenanceCounts.synthetic).toBe(81);
  });

  it("requires strict benchmark case schema fields", () => {
    const [benchmarkCase] = loadBenchmarkCases();
    expect(BenchmarkCaseSchema.safeParse(benchmarkCase).success).toBe(true);
    expect(
      BenchmarkCaseSchema.safeParse({
        ...benchmarkCase,
        unexpectedField: true,
      }).success,
    ).toBe(false);
    expect(
      BenchmarkCaseSchema.safeParse({
        ...benchmarkCase,
        provenance: "real_scrape",
      }).success,
    ).toBe(false);
  });

  it("validates manifest, labels, provenance, and split leakage", () => {
    const result = validateBenchmarkDataset();
    expect(result.valid).toBe(true);

    const cases = loadBenchmarkCases();
    const manifest = loadBenchmarkManifest();
    const duplicate = validateBenchmarkDatasetInput(
      [cases[0]!, { ...cases[1]!, id: cases[0]!.id }],
      { ...manifest, caseCount: 2, splitCounts: { dev: 2, test: 0 } },
    );
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors.join("\n")).toContain("Duplicate");

    const leaked = validateBenchmarkDatasetInput(
      [cases[0]!, { ...cases[0]!, id: "leaked_test_case", split: "test" }],
      { ...manifest, caseCount: 2, splitCounts: { dev: 1, test: 1 } },
    );
    expect(leaked.valid).toBe(false);
    expect(leaked.errors.join("\n")).toContain("Split leakage");
  });
});
