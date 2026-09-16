import {
  RevisionProposalSchema,
  type DimensionReviewResult,
  type RevisionProposal,
} from "../schemas/multi-agent.js";

export function proposeRevision(
  results: DimensionReviewResult[],
): RevisionProposal {
  const issues = results.flatMap(({ issues }) =>
    issues.map((issue) => ({
      issueId: issue.id,
      category: issue.category,
      reason: issue.reason,
    })),
  );
  const revisionDirection = [
    ...new Set(results.flatMap(({ suggestedChanges }) => suggestedChanges)),
  ];

  return RevisionProposalSchema.parse({
    issues,
    revisionDirection,
    suggestedContent: null,
    reason:
      issues.length === 0
        ? "No automatic revision is required for the current result."
        : "Revision direction is derived from issue, reason, and evidence; callers must create a new content version.",
  });
}
