import {
  publicContentReviewBenchmarkV1Cases,
  publicContentReviewBenchmarkV1Manifest,
} from "./dataset/public-content-review-benchmark-v1.js";
import type {
  BenchmarkCase,
  BenchmarkManifest,
  BenchmarkSplit,
} from "./schemas.js";

export function loadBenchmarkCases(input?: {
  split?: BenchmarkSplit;
}): BenchmarkCase[] {
  const cases = publicContentReviewBenchmarkV1Cases;
  return input?.split
    ? cases.filter((benchmarkCase) => benchmarkCase.split === input.split)
    : [...cases];
}

export function loadBenchmarkManifest(): BenchmarkManifest {
  return publicContentReviewBenchmarkV1Manifest;
}
