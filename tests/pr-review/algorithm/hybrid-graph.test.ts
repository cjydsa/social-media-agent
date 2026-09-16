import { describe, expect, it, jest } from "@jest/globals";
import {
  createLangGraphReviewEngine,
  type ReviewAgentSet,
} from "../../../src/pr-review/algorithm/index.js";
import {
  DeterministicEvidenceToolset,
  VisualEvidenceToolset,
  type VisualEvidenceAnalyzer,
} from "../../../src/pr-review/algorithm/evidence/evidence-tools.js";
import {
  visionEvidenceItems,
  type VisualAnalysisResult,
} from "../../../src/pr-review/algorithm/llm/index.js";
import {
  ReviewPlanSchema,
  type ReviewPlan,
} from "../../../src/pr-review/algorithm/schemas/multi-agent.js";
import {
  createAlgorithmContext,
  createAlgorithmInput,
  createDimensionResult,
  fiveDimensionResults,
} from "./fixtures.js";

const fiveDimensions: ReviewPlan["requiredDimensions"] = [
  "PUBLIC_RELATIONS",
  "OPERATIONS",
  "PRODUCT",
  "CUSTOMER",
  "COMPLIANCE_SAFETY",
];

function basePlan(): ReviewPlan {
  return ReviewPlanSchema.parse({
    requiredDimensions: [...fiveDimensions],
    reviewDepthByDimension: {
      PUBLIC_RELATIONS: "LIGHT",
      OPERATIONS: "LIGHT",
      PRODUCT: "LIGHT",
      CUSTOMER: "LIGHT",
      COMPLIANCE_SAFETY: "LIGHT",
    },
    requiredEvidenceSources: [],
    requiresSocialContext: false,
    requiresProductKnowledge: false,
    requiresPlatformPolicy: false,
    requiresVisualAnalysis: false,
    planningReason: "Hybrid test plan with per-dimension rationale.",
  });
}

function criticFrom(results: ReturnType<typeof fiveDimensionResults>) {
  const supported = results.flatMap(({ issues }) => issues.map(({ id }) => id));
  return {
    supportedIssueIds: supported,
    unsupportedIssueIds: [] as string[],
    conflicts: [] as Array<{
      dimensions: ReturnType<typeof fiveDimensionResults>[number]['dimension'][];
      reason: string;
      evidenceIds: string[];
    }>,
    missingEvidence: [] as import('../../../src/pr-review/algorithm/schemas/multi-agent.js').ReviewEvidenceSource[],
    requiresHuman: false,
    reason: "All issues trace to cited evidence; no cross-dimension conflict.",
  };
}

function judgeFrom(results: ReturnType<typeof fiveDimensionResults>) {
  const top = Math.max(0, ...results.map(({ riskScore }) => riskScore));
  return {
    decision:
      top === 0 ? ("PASS" as const) : ("HUMAN_REVIEW" as const),
    overallRiskScore: top,
    confidence: 0.9,
    summary: "Hybrid test judge summary.",
    topRisks: top === 0 ? [] : ["Test-driven top risk"],
    revisionPriority: [],
    judgeReason:
      "Overall risk score derives from the highest weighted dimension result in the hybrid test.",
  };
}

function makeAgent(overrides: Partial<ReviewAgentSet> = {}): ReviewAgentSet {
  return {
    plan: jest.fn(async () => basePlan()),
    reviewDimension: jest.fn(async ({ dimension }) =>
      createDimensionResult(dimension, {
        riskScore: 0,
        confidence: 0.95,
        verdict: "PASS",
        reason: "LLM 论证：本维度未发现风险，原文无相关表述（模拟理由）。",
      }),
    ) as unknown as ReviewAgentSet["reviewDimension"],
    critique: jest.fn(
      async (payload: {
        input: unknown;
        results: ReturnType<typeof fiveDimensionResults>;
        coverage: unknown;
      }) => criticFrom(payload.results),
    ) as unknown as ReviewAgentSet["critique"],
    judge: jest.fn(
      async (payload: {
        input: unknown;
        results: ReturnType<typeof fiveDimensionResults>;
        critic: unknown;
      }) => judgeFrom(payload.results),
    ) as unknown as ReviewAgentSet["judge"],
    revise: jest.fn(async () => ({
      issues: [],
      revisionDirection: [],
      suggestedContent: null,
      reason: "无需修订。",
    })) as unknown as ReviewAgentSet["revise"],
    ...overrides,
  };
}

describe("SPRINT-006 hybrid runtime (LLM agent injection)", () => {
  it("routes every review node through the injected LLM agents", async () => {
    const agents = makeAgent();
    const engine = createLangGraphReviewEngine({ agents });
    const input = createAlgorithmInput("normal");

    const output = await engine.review(input, createAlgorithmContext());

    expect(agents.plan).toHaveBeenCalledTimes(1);
    expect(agents.reviewDimension).toHaveBeenCalledTimes(5);
    expect(agents.critique).toHaveBeenCalledTimes(1);
    expect(agents.judge).toHaveBeenCalledTimes(1);
    // LLM-authored rationale persists into the final decision.
    expect(output.finalDecision?.dimensionResults[0]?.reason).toBe(
      "LLM 论证：本维度未发现风险，原文无相关表述（模拟理由）。",
    );
    expect(output.finalDecision?.decision).toBe("PASS");
  });

  it("forces the LLM specialist's dimension back when the model drifts", async () => {
    const agents = makeAgent({
      reviewDimension: jest.fn(async ({ dimension }) =>
        createDimensionResult("OPERATIONS", {
          dimension,
          riskScore: 0,
          verdict: "PASS",
          reason: "模型漂移测试：忽略输入维度。",
        }),
      ),
    } as unknown as Partial<ReviewAgentSet>);
    const engine = createLangGraphReviewEngine({ agents });
    const output = await engine.review(
      createAlgorithmInput("normal"),
      createAlgorithmContext(),
    );
    const dimensions = output.finalDecision?.dimensionResults.map(
      ({ dimension }) => dimension,
    );
    expect(new Set(dimensions).size).toBe(5);
    expect(dimensions).toEqual(
      expect.arrayContaining(fiveDimensions),
    );
  });

  it("fails closed when the LLM specialist throws", async () => {
    const agents = makeAgent({
      reviewDimension: jest.fn(
        async ({ dimension }) =>
          dimension === "COMPLIANCE_SAFETY"
            ? (Promise.reject(new Error("LLM call timed out.")) as never)
            : createDimensionResult(dimension),
      ),
    } as unknown as Partial<ReviewAgentSet>);
    const engine = createLangGraphReviewEngine({ agents });
    const output = await engine.review(
      createAlgorithmInput("normal"),
      createAlgorithmContext(),
    );
    expect(output.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REVIEWER_FAILED",
          source: "REVIEW_ENGINE",
          details: { dimension: "COMPLIANCE_SAFETY" },
        }),
      ]),
    );
    expect(output.requiresHuman).toBe(true);
    expect(output.finalDecision?.decision).toBe("HUMAN_REVIEW");
  });

  it("falls back to the deterministic planner when the LLM planner throws", async () => {
    const agents = makeAgent({
      plan: jest.fn(async () => {
        throw new Error("planner schema validation failed");
      }),
    } as unknown as Partial<ReviewAgentSet>);
    const engine = createLangGraphReviewEngine({ agents });
    const output = await engine.review(
      createAlgorithmInput("normal"),
      createAlgorithmContext(),
    );
    // Fallback plan keeps the graph moving; the recorded failure forces
    // human review downstream (fail closed).
    expect(output.reviewPlan?.planningReason).toBe(
      "公网内容执行五维 LIGHT 基线审核。",
    );
    expect(output.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "MODEL", details: { role: "planner" } }),
      ]),
    );
    expect(output.requiresHuman).toBe(true);
  });

  it("mock mode (no agents) never invokes the LLM port", async () => {
    const engine = createLangGraphReviewEngine();
    const output = await engine.review(
      createAlgorithmInput("normal"),
      createAlgorithmContext(),
    );
    expect(output.finalDecision?.decision).toBe("PASS");
    // Deterministic reviewer names prove no LLM agent ran.
    expect(output.results.map(({ reviewerName }) => reviewerName)).toEqual(
      expect.arrayContaining([
        "deterministic-public_relations",
        "deterministic-compliance_safety",
      ]),
    );
  });

  it("detects cross-dimension conflict and reports it in judgeReason", async () => {
    const agents = makeAgent({
      reviewDimension: jest.fn(async ({ dimension }) => {
        // PRODUCT says fine, COMPLIANCE says blocked for same claim
        if (dimension === "COMPLIANCE_SAFETY") {
          return createDimensionResult(dimension, {
            riskScore: 85,
            verdict: "BLOCK",
            reason: "『全网最低价』属广告法绝对化用语，严重违规。",
            issues: [
              {
                id: "issue-block-001",
                category: "COMPLIANCE",
                severity: "HIGH",
                textSpan: { start: 0, end: 5, quote: "全网最低价" },
                reason: "广告法第九条绝对化用语。",
                evidenceIds: [],
                suggestion: "改为『限时特惠价』",
              },
            ],
          });
        }
        return createDimensionResult(dimension, {
          riskScore: 0,
          verdict: "PASS",
          reason: "本维度无风险。",
        });
      }) as unknown as ReviewAgentSet["reviewDimension"],
    });
    const engine = createLangGraphReviewEngine({ agents });
    const input = createAlgorithmInput("normal");
    const output = await engine.review(input, createAlgorithmContext());
    expect(output.finalDecision?.decision).toBe("BLOCK");
    expect(output.finalDecision?.blockingIssues.length).toBeGreaterThan(0);
  });
});

describe("SPRINT-006 multimodal evidence", () => {
  const visionResult: VisualAnalysisResult = {
    ocrText: "限时特惠 立减100",
    sceneDescription: "商品海报，背景为红色促销元素。",
    visualElements: ["价格标签", "二维码", "商品图"],
    riskObservations: [
      {
        observation: "绝对化用语「最优惠」涉嫌违反广告法。",
        severity: "HIGH",
      },
    ],
    brandSafety: "WARN",
    brandSafetyReason: "出现未经备案的第三方标识。",
  };

  function makeVisualAnalyzer(
    failures = 0,
  ): VisualEvidenceAnalyzer {
    let called = 0;
    return {
      analyze: jest.fn(async () => {
        called += 1;
        if (called <= failures) throw new Error("vision provider 500");
        return visionResult;
      }),
    };
  }

  function visualPlan(withMultimodal: boolean): ReviewPlan {
    const plan = basePlan();
    plan.requiredEvidenceSources = withMultimodal
      ? ["MULTIMODAL_EVIDENCE"]
      : [];
    return ReviewPlanSchema.parse(plan);
  }

  it("converts vision analyses into MULTIMODAL_EVIDENCE items", async () => {
    const analyzer = makeVisualAnalyzer();
    const toolset = new VisualEvidenceToolset(
      new DeterministicEvidenceToolset(),
      analyzer,
    );
    const result = await toolset.collect(
      visualPlan(true),
      "normal",
      { ...createAlgorithmInput("normal"), imageUrls: ["/uploads/a.png"] },
    );
    expect(result.evidence.map(({ sourceType }) => sourceType)).toContain(
      "IMAGE",
    );
    expect(result.coverage.missingSources).not.toContain(
      "MULTIMODAL_EVIDENCE",
    );
    expect(result.evidence.map(({ content }) => content)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("图中文字：限时特惠 立减100"),
        expect.stringContaining("[HIGH] 绝对化用语"),
      ]),
    );
  });

  it("reports MULTIMODAL_EVIDENCE missing when the vision call fails", async () => {
    const analyzer = makeVisualAnalyzer(2);
    const toolset = new VisualEvidenceToolset(
      new DeterministicEvidenceToolset(),
      analyzer,
    );
    const result = await toolset.collect(
      visualPlan(true),
      "normal",
      {
        ...createAlgorithmInput("normal"),
        imageUrls: ["/uploads/a.png", "/uploads/b.png"],
      },
    );
    expect(result.coverage.missingSources).toContain("MULTIMODAL_EVIDENCE");
    expect(result.coverage.coverageScore).toBe(0);
  });

  it("leaves vision evidence missing when no images are submitted", async () => {
    const analyzer = makeVisualAnalyzer();
    const toolset = new VisualEvidenceToolset(
      new DeterministicEvidenceToolset(),
      analyzer,
    );
    const result = await toolset.collect(
      visualPlan(true),
      "normal",
      createAlgorithmInput("normal"),
    );
    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(result.coverage.missingSources).toContain("MULTIMODAL_EVIDENCE");
  });

  it("ignores MULTIMODAL_EVIDENCE when the plan does not require it", async () => {
    const analyzer = makeVisualAnalyzer();
    const toolset = new VisualEvidenceToolset(
      new DeterministicEvidenceToolset(),
      analyzer,
    );
    const result = await toolset.collect(
      visualPlan(false),
      "normal",
      { ...createAlgorithmInput("normal"), imageUrls: ["/uploads/a.png"] },
    );
    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(result.evidence).toHaveLength(0);
  });

  it("formats vision evidence items with the top-severity title", () => {
    const items = visionEvidenceItems([visionResult]);
    expect(items[0].sourceType).toBe("IMAGE");
    expect(items[0].title).toContain("WARN");
    expect(items[0].title).toContain("最高风险 HIGH");
    expect(items[0].source).toBe("qwen-vision");
  });

  it("routes a hybrid run with images to HUMAN_REVIEW when vision is unavailable", async () => {
    const agents = makeAgent({
      plan: jest.fn(async () => visualPlan(true)),
    } as unknown as Partial<ReviewAgentSet>);
    const engine = createLangGraphReviewEngine({
      agents,
      evidenceToolset: new VisualEvidenceToolset(
        new DeterministicEvidenceToolset(),
        null,
      ),
    });
    const input = {
      ...createAlgorithmInput("normal"),
      imageUrls: ["/uploads/a.png"],
      contentType: "MULTIMODAL_POST" as const,
    };
    const output = await engine.review(input, createAlgorithmContext());
    expect(output.finalDecision?.evidenceCoverage.missingSources).toContain(
      "MULTIMODAL_EVIDENCE",
    );
    expect(output.requiresHuman).toBe(true);
  });
});
