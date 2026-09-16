import { describe, expect, it, jest } from "@jest/globals";
import {
  DEFAULT_REVIEW_POLICY,
  createLangGraphReviewEngine,
  type ResumeReviewInput,
  type SocialContextProvider,
} from "../../../src/pr-review/algorithm/index.js";
import { createAlgorithmContext, createAlgorithmInput } from "./fixtures.js";

function resumeInput(
  executionId: string,
  caseId: string,
  action: ResumeReviewInput["action"],
  revisedContent: string | null = null,
): ResumeReviewInput {
  const common = {
    executionId,
    caseId,
    version: 1,
    actor: {
      id: "actor-synthetic",
      displayName: "Synthetic Reviewer",
      role: "MEDIA_MANAGER",
    },
    reason: "Synthetic resume action.",
  };
  return action === "REVISE"
    ? {
        ...common,
        action,
        revisedContent: revisedContent ?? "[scenario:normal] revised",
      }
    : { ...common, action, revisedContent: null };
}

describe("five-dimension LangGraph ReviewEngine", () => {
  it.each([
    ["normal", "PASS"],
    ["pr-risk", "REVISE"],
    ["operations-risk", "REVISE"],
    ["customer-risk", "REVISE"],
    ["missing-evidence", "HUMAN_REVIEW"],
    ["reviewer-conflict", "HUMAN_REVIEW"],
    ["reviewer-failure", "HUMAN_REVIEW"],
    ["product-risk", "BLOCK"],
    ["compliance-risk", "BLOCK"],
  ] as const)("routes %s to %s", async (scenario, expectedDecision) => {
    const output = await createLangGraphReviewEngine().review(
      createAlgorithmInput(scenario),
      createAlgorithmContext(),
    );
    expect(output.finalDecision?.decision).toBe(expectedDecision);
    expect(output.finalDecision?.dimensionResults).toHaveLength(5);
    if (expectedDecision !== "PASS") {
      expect(output.finalDecision?.publishable).toBe(false);
    }
  });

  it("fails closed when a specialist throws", async () => {
    const output = await createLangGraphReviewEngine().review(
      createAlgorithmInput("reviewer-failure"),
      createAlgorithmContext(),
    );
    expect(output.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "REVIEWER_FAILED" }),
      ]),
    );
    expect(output.requiresHuman).toBe(true);
    expect(output.interrupt).not.toBeNull();
  });

  it.each(["APPROVE", "REJECT", "ESCALATE"] as const)(
    "supports %s resume",
    async (action) => {
      const engine = createLangGraphReviewEngine();
      const input = createAlgorithmInput("operations-risk");
      const first = await engine.review(input, createAlgorithmContext());
      const resumed = await engine.resume(
        resumeInput(first.execution.executionId, input.caseId, action),
        createAlgorithmContext(),
      );
      expect(resumed.interrupt).toBeNull();
      expect(resumed.nextStage).toBe(
        action === "REJECT"
          ? "REJECTED"
          : action === "ESCALATE"
            ? "ESCALATED"
            : "COMPLETED",
      );
    },
  );

  it("revises content, increments version and re-enters review", async () => {
    const engine = createLangGraphReviewEngine();
    const input = createAlgorithmInput("operations-risk");
    const first = await engine.review(input, createAlgorithmContext());
    const resumed = await engine.resume(
      resumeInput(
        first.execution.executionId,
        input.caseId,
        "REVISE",
        "[scenario:normal] revised synthetic content",
      ),
      createAlgorithmContext(),
    );
    expect(resumed.version).toBe(2);
    expect(resumed.finalDecision?.decision).toBe("PASS");
    expect(resumed.interrupt).toBeNull();
  });

  it("escalates when the configurable revision limit is reached", async () => {
    const engine = createLangGraphReviewEngine({
      policy: { ...DEFAULT_REVIEW_POLICY, maxRevisionCount: 1 },
      scenarioResolver: () => "operations-risk",
    });
    const input = createAlgorithmInput("operations-risk");
    const first = await engine.review(input, createAlgorithmContext());
    const resumed = await engine.resume(
      resumeInput(first.execution.executionId, input.caseId, "REVISE"),
      createAlgorithmContext(),
    );
    expect(resumed.nextStage).toBe("ESCALATED");
    expect(resumed.finalDecision?.decision).toBe("HUMAN_REVIEW");
  });

  it("isolates case state and is semantically deterministic", async () => {
    const engine = createLangGraphReviewEngine();
    const [first, second] = await Promise.all([
      engine.review(
        createAlgorithmInput("normal", "case-a"),
        createAlgorithmContext(),
      ),
      engine.review(
        createAlgorithmInput("normal", "case-b"),
        createAlgorithmContext(),
      ),
    ]);
    expect(first.caseId).toBe("case-a");
    expect(second.caseId).toBe("case-b");
    expect(first.execution.threadId).not.toBe(second.execution.threadId);
    expect(first.finalDecision).toEqual(second.finalDecision);
  });

  it("does not invoke real API-facing dependencies", async () => {
    const socialContextProvider = {
      getSnapshot: jest.fn<SocialContextProvider["getSnapshot"]>(async () => {
        throw new Error(
          "Social provider must not be called by deterministic tests.",
        );
      }),
    };
    const context = createAlgorithmContext();
    context.dependencies.socialContextProvider = socialContextProvider;
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    try {
      await createLangGraphReviewEngine().review(
        createAlgorithmInput("multi-risk"),
        context,
      );
      expect(socialContextProvider.getSnapshot).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
