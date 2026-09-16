import { describe, expect, it } from "@jest/globals";
import {
  ReviewResultSchema,
  validateReviewResultAgainstContent,
} from "../../../src/pr-review/algorithm/index.js";
import {
  createReviewResultFixture,
  createReviewResultWithSpan,
} from "./fixtures.js";

describe("ReviewResult contract", () => {
  it.each([0, 1])("accepts confidence boundary %s", (confidence) => {
    expect(
      ReviewResultSchema.safeParse({
        ...createReviewResultFixture(),
        confidence,
      }).success,
    ).toBe(true);
  });

  it.each([-0.01, 1.01])(
    "rejects confidence outside [0,1]: %s",
    (confidence) => {
      expect(
        ReviewResultSchema.safeParse({
          ...createReviewResultFixture(),
          confidence,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects invalid latency, token, cost, and evidence score values", () => {
    const fixture = createReviewResultFixture();
    expect(
      ReviewResultSchema.safeParse({ ...fixture, latencyMs: -1 }).success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        modelUsage: { ...fixture.modelUsage, inputTokens: -1 },
      }).success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        modelUsage: { ...fixture.modelUsage, outputTokens: 0.5 },
      }).success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        modelUsage: { ...fixture.modelUsage, estimatedCost: -0.01 },
      }).success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        evidence: [{ ...fixture.evidence[0], score: 1.01 }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields at top-level and fixed nested levels", () => {
    const fixture = createReviewResultFixture();
    expect(
      ReviewResultSchema.safeParse({ ...fixture, automaticApproval: true })
        .success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        modelUsage: { ...fixture.modelUsage, unknownField: true },
      }).success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse({
        ...fixture,
        evidence: [{ ...fixture.evidence[0], unknownField: true }],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["hello world", 0, 5],
    ["你好世界", 1, 3],
    ["A😀B", 1, 3],
  ] as const)(
    "validates %s span using UTF-16 [start,end)",
    (content, start, end) => {
      expect(
        validateReviewResultAgainstContent(
          createReviewResultWithSpan(content, start, end),
          content,
        ).issues[0]?.textSpan?.quote,
      ).toBe(content.slice(start, end));
    },
  );

  it("rejects contextual quote mismatch and out-of-bounds end", () => {
    const content = "A😀B";
    const mismatch = createReviewResultWithSpan(content, 1, 3);
    mismatch.issues[0]!.textSpan!.quote = "wrong";
    expect(() =>
      validateReviewResultAgainstContent(mismatch, content),
    ).toThrow();

    const outOfBounds = createReviewResultWithSpan(
      content,
      1,
      content.length + 1,
    );
    expect(() =>
      validateReviewResultAgainstContent(outOfBounds, content),
    ).toThrow();
  });

  it("rejects negative start and end not greater than start structurally", () => {
    expect(
      ReviewResultSchema.safeParse(createReviewResultWithSpan("hello", -1, 2))
        .success,
    ).toBe(false);
    expect(
      ReviewResultSchema.safeParse(createReviewResultWithSpan("hello", 2, 2))
        .success,
    ).toBe(false);
  });

  it("preserves valid semantics through JSON round trip", () => {
    const parsed = ReviewResultSchema.parse(createReviewResultFixture());
    expect(
      ReviewResultSchema.parse(JSON.parse(JSON.stringify(parsed))),
    ).toEqual(parsed);
  });
});
