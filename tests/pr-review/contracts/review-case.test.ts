import { describe, expect, it } from "@jest/globals";
import { ReviewCaseSchema } from "../../../src/pr-review/algorithm/index.js";
import { createReviewCaseFixture } from "./fixtures.js";

describe("ReviewCase contract", () => {
  it("parses a valid object and preserves it through JSON round trip", () => {
    const parsed = ReviewCaseSchema.parse(createReviewCaseFixture());
    const roundTripped = JSON.parse(JSON.stringify(parsed));

    expect(ReviewCaseSchema.parse(roundTripped)).toEqual(parsed);
  });

  it("rejects version zero", () => {
    expect(
      ReviewCaseSchema.safeParse({ ...createReviewCaseFixture(), version: 0 })
        .success,
    ).toBe(false);
  });

  it.each(["not-a-timestamp", "2026-08-31T08:00:00"])(
    "rejects invalid or timezone-free timestamp %s",
    (createdAt) => {
      expect(
        ReviewCaseSchema.safeParse({
          ...createReviewCaseFixture(),
          createdAt,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects unknown top-level and nested fields", () => {
    expect(
      ReviewCaseSchema.safeParse({
        ...createReviewCaseFixture(),
        unknownField: true,
      }).success,
    ).toBe(false);
    expect(
      ReviewCaseSchema.safeParse({
        ...createReviewCaseFixture(),
        submitter: {
          ...createReviewCaseFixture().submitter,
          unknownField: true,
        },
      }).success,
    ).toBe(false);
  });
});
