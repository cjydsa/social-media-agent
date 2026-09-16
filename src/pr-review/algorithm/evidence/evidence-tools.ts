import type { EvidenceItem } from "../schemas/review-result.js";
import type {
  EvidenceCoverage,
  ReviewEvidenceSource,
  ReviewPlan,
} from "../schemas/multi-agent.js";
import type { ReviewScenario } from "../agents/types.js";

export interface EvidencePlanResult {
  evidence: EvidenceItem[];
  coverage: EvidenceCoverage;
}

export interface EvidenceToolset {
  collect(
    plan: ReviewPlan,
    scenario: ReviewScenario,
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
