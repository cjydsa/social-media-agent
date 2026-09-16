import {
  JudgeRecommendationSchema,
  type DimensionReviewResult,
  type EvidenceCriticResult,
  type JudgeRecommendation,
  type ReviewPolicy,
} from "../schemas/multi-agent.js";

export function judgeReview(
  results: DimensionReviewResult[],
  critic: EvidenceCriticResult,
  policy: ReviewPolicy,
): JudgeRecommendation {
  const overallRiskScore = results.reduce(
    (total, result) =>
      total + result.riskScore * policy.weights[result.dimension],
    0,
  );
  const confidence = Math.min(...results.map((result) => result.confidence));
  const highest = [...results].sort(
    (left, right) => right.riskScore - left.riskScore,
  );
  const topRisks = highest
    .filter(({ riskScore }) => riskScore >= 40)
    .map(({ dimension, reason }) => `${dimension}: ${reason}`);
  const revisionPriority = highest.flatMap(({ suggestedChanges }) =>
    suggestedChanges.slice(0, 1),
  );

  const decision = critic.requiresHuman
    ? "HUMAN_REVIEW"
    : overallRiskScore <= policy.thresholds.passOverallMax
      ? "PASS"
      : overallRiskScore <= policy.thresholds.reviseOverallMax
        ? "REVISE"
        : "BLOCK";

  return JudgeRecommendationSchema.parse({
    decision,
    overallRiskScore,
    confidence,
    summary:
      topRisks.length === 0
        ? "五维审核未发现需要阻断发布的主要风险。"
        : `优先处理 ${topRisks.length} 个高关注维度。`,
    topRisks,
    revisionPriority,
    judgeReason:
      "Decision Judge 综合五维分数、置信度与 Evidence Critic 结果给出 AI 推荐；最终决定由 Policy Guard 约束。",
  });
}
