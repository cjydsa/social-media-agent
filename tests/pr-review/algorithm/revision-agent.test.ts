import { describe, expect, it } from "@jest/globals";
import { proposeRevision } from "../../../src/pr-review/algorithm/agents/revision-agent.js";
import { createDimensionResult } from "./fixtures.js";

describe("deterministic RevisionAgent", () => {
  it("returns issue, reason and direction without mutating content", () => {
    const proposal = proposeRevision([
      createDimensionResult("PRODUCT", {
        riskScore: 70,
        verdict: "BLOCK",
        issues: [
          {
            id: "issue-product-claim",
            category: "UNSUPPORTED_PRODUCT_CLAIM",
            severity: "HIGH",
            textSpan: null,
            reason: "Synthetic product claim lacks approved evidence.",
            evidenceIds: ["evidence-product-1"],
            suggestion: "Replace unsupported claim with approved wording.",
          },
        ],
        suggestedChanges: ["Replace unsupported product claim."],
      }),
    ]);

    expect(proposal.issues).toEqual([
      {
        issueId: "issue-product-claim",
        category: "UNSUPPORTED_PRODUCT_CLAIM",
        reason: "Synthetic product claim lacks approved evidence.",
      },
    ]);
    expect(proposal.revisionDirection).toContain(
      "Replace unsupported product claim.",
    );
    expect(proposal.suggestedContent).toBeNull();
    expect(proposal.reason).toContain("Revision direction");
  });
});
