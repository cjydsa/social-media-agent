import {
  EvidenceCriticResultSchema,
  type DimensionReviewResult,
  type EvidenceCriticResult,
  type EvidenceCoverage,
} from "../schemas/multi-agent.js";
import type { ReviewScenario } from "./types.js";

export function critiqueEvidence(
  results: DimensionReviewResult[],
  coverage: EvidenceCoverage,
  scenario: ReviewScenario,
): EvidenceCriticResult {
  const supportedIssueIds = results.flatMap(({ issues }) =>
    issues
      .filter(({ evidenceIds }) => evidenceIds.length > 0)
      .map(({ id }) => id),
  );
  const unsupportedIssueIds = results.flatMap(({ issues }) =>
    issues
      .filter(({ evidenceIds }) => evidenceIds.length === 0)
      .map(({ id }) => id),
  );
  const conflicts =
    scenario === "reviewer-conflict"
      ? [
          {
            dimensions: ["PUBLIC_RELATIONS", "PRODUCT"] as const,
            reason: "公关语境风险与产品证据判断存在显著分歧。",
            evidenceIds: results.flatMap(({ evidenceIds }) => evidenceIds),
          },
        ]
      : [];
  const requiresHuman =
    coverage.missingSources.length > 0 ||
    unsupportedIssueIds.length > 0 ||
    conflicts.length > 0;

  return EvidenceCriticResultSchema.parse({
    supportedIssueIds,
    unsupportedIssueIds,
    conflicts,
    missingEvidence: coverage.missingSources,
    requiresHuman,
    reason: requiresHuman
      ? "发现证据缺口、无支持结论或 Specialist 冲突。"
      : "问题与证据引用匹配，未发现跨维冲突。",
  });
}
