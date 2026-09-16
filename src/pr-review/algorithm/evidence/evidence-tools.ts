import type { EvidenceItem } from "../schemas/review-result.js";
import type {
  EvidenceCoverage,
  ReviewEvidenceSource,
  ReviewPlan,
} from "../schemas/multi-agent.js";
import type { ReviewEngineInput } from "../schemas/review-engine.js";
import type { ReviewScenario } from "../agents/types.js";
import type { VisualAnalysisResult } from "../llm/visual-analysis.js";
import { visionEvidenceItems } from "../llm/visual-analysis.js";

export interface EvidencePlanResult {
  evidence: EvidenceItem[];
  coverage: EvidenceCoverage;
}

export interface EvidenceToolset {
  collect(
    plan: ReviewPlan,
    scenario: ReviewScenario,
    input?: ReviewEngineInput,
  ): Promise<EvidencePlanResult>;
}

function evidenceId(source: ReviewEvidenceSource): string {
  return `evidence-${source.toLowerCase().replaceAll("_", "-")}`;
}

export class DeterministicEvidenceToolset implements EvidenceToolset {
  async collect(
    plan: ReviewPlan,
    scenario: ReviewScenario,
  ): Promise<EvidencePlanResult> {
    const missingSources: ReviewEvidenceSource[] =
      scenario === "missing-evidence"
        ? plan.requiredEvidenceSources.filter(
            (source) => source === "PRODUCT_KNOWLEDGE",
          )
        : [];
    const availableSources = plan.requiredEvidenceSources.filter(
      (source) => !missingSources.includes(source),
    );
    const requiredCount = plan.requiredEvidenceSources.length;

    return {
      evidence: availableSources.map((source) => ({
        id: evidenceId(source),
        sourceType: source === "MULTIMODAL_EVIDENCE" ? "IMAGE" : "RULE",
        title: `${source} contract evidence`,
        content: "Synthetic contract-only evidence.",
        source: `synthetic:${source.toLowerCase()}`,
        score: 1,
      })),
      coverage: {
        requiredSources: plan.requiredEvidenceSources,
        availableSources,
        missingSources,
        coverageScore:
          requiredCount === 0 ? 1 : availableSources.length / requiredCount,
      },
    };
  }
}

export function evidenceIdFor(source: ReviewEvidenceSource): string {
  return evidenceId(source);
}

export interface VisualEvidenceAnalyzer {
  analyze(imageUrl: string): Promise<VisualAnalysisResult>;
}

/**
 * Evidence toolset that resolves MULTIMODAL_EVIDENCE through a real vision
 * model (SPRINT-006). All non-visual sources fall back to the deterministic
 * toolset; a vision failure or missing images leaves MULTIMODAL_EVIDENCE
 * missing so the Policy Guard can fail closed.
 */
export class VisualEvidenceToolset implements EvidenceToolset {
  constructor(
    private readonly base: EvidenceToolset,
    private readonly analyzer: VisualEvidenceAnalyzer | null,
    private readonly maxImages = 4,
  ) {}

  async collect(
    plan: ReviewPlan,
    scenario: ReviewScenario,
    input?: ReviewEngineInput,
  ): Promise<EvidencePlanResult> {
    const baseResult = await this.base.collect(plan, scenario, input);
    const requiresVisual = plan.requiredEvidenceSources.includes(
      "MULTIMODAL_EVIDENCE",
    );
    if (!requiresVisual) return baseResult;

    const imageUrls = (input?.imageUrls ?? []).slice(0, this.maxImages);
    const visual =
      this.analyzer && imageUrls.length > 0
        ? await this.#analyzeImages(imageUrls)
        : null;

    const visualAvailable = visual !== null;
    const availableSources = visualAvailable
      ? [
          ...baseResult.coverage.availableSources.filter(
            (source) => source !== "MULTIMODAL_EVIDENCE",
          ),
          "MULTIMODAL_EVIDENCE" as const,
        ]
      : baseResult.coverage.availableSources.filter(
          (source) => source !== "MULTIMODAL_EVIDENCE",
        );
    const missingSources = visualAvailable
      ? baseResult.coverage.missingSources.filter(
          (source) => source !== "MULTIMODAL_EVIDENCE",
        )
      : [
          ...baseResult.coverage.missingSources.filter(
            (source) => source !== "MULTIMODAL_EVIDENCE",
          ),
          "MULTIMODAL_EVIDENCE" as const,
        ];
    const requiredCount = plan.requiredEvidenceSources.length;

    return {
      evidence: [...baseResult.evidence, ...(visual?.evidence ?? [])],
      coverage: {
        requiredSources: plan.requiredEvidenceSources,
        availableSources,
        missingSources,
        coverageScore:
          requiredCount === 0
            ? 1
            : availableSources.length / requiredCount,
      },
    };
  }

  async #analyzeImages(
    imageUrls: string[],
  ): Promise<{ evidence: EvidenceItem[] } | null> {
    try {
      const analyses = await Promise.all(
        imageUrls.map((url) => this.analyzer!.analyze(url)),
      );
      return { evidence: visionEvidenceItems(analyses) };
    } catch {
      // Fail closed: report MULTIMODAL_EVIDENCE as unavailable.
      return null;
    }
  }
}
