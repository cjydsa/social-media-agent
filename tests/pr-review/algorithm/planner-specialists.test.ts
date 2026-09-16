import { describe, expect, it } from "@jest/globals";
import {
  createLangGraphReviewEngine,
  REVIEW_DIMENSIONS,
} from "../../../src/pr-review/algorithm/index.js";
import { createAlgorithmContext, createAlgorithmInput } from "./fixtures.js";

describe("Planner and five deterministic specialists", () => {
  it.each([
    "normal",
    "pr-risk",
    "operations-risk",
    "product-risk",
    "customer-risk",
    "compliance-risk",
    "multi-risk",
  ])("returns all five dimensions for %s", async (scenario) => {
    const output = await createLangGraphReviewEngine().review(
      createAlgorithmInput(scenario),
      createAlgorithmContext(),
    );
    expect(output.reviewPlan?.requiredDimensions).toEqual(REVIEW_DIMENSIONS);
    expect(output.reviewPlan?.reviewDepthByDimension.COMPLIANCE_SAFETY).toMatch(
      /LIGHT|FULL/,
    );
    expect(output.finalDecision?.dimensionResults).toHaveLength(5);
    expect(
      new Set(
        output.finalDecision?.dimensionResults.map(
          ({ dimension }) => dimension,
        ),
      ).size,
    ).toBe(5);
  });

  it("treats images as multimodal evidence rather than a sixth dimension", async () => {
    const input = createAlgorithmInput("normal");
    input.imageUrls = ["https://example.invalid/synthetic.png"];
    const output = await createLangGraphReviewEngine().review(
      input,
      createAlgorithmContext(),
    );
    expect(output.reviewPlan?.requiresVisualAnalysis).toBe(true);
    expect(output.reviewPlan?.requiredEvidenceSources).toContain(
      "MULTIMODAL_EVIDENCE",
    );
    expect(output.finalDecision?.dimensionResults).toHaveLength(5);
  });
});
