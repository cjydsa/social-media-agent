import { ReviewResultSchema } from "../schemas/review-result.js";
import type { ReviewResult } from "../schemas/review-result.js";

export function validateReviewResultAgainstContent(
  result: unknown,
  currentContent: string,
): ReviewResult {
  return ReviewResultSchema.superRefine((candidate, context) => {
    candidate.issues.forEach((issue, issueIndex) => {
      const span = issue.textSpan;
      if (span === null) return;

      if (span.end > currentContent.length) {
        context.addIssue({
          code: "custom",
          message: "textSpan.end exceeds currentContent UTF-16 length.",
          path: ["issues", issueIndex, "textSpan", "end"],
        });
        return;
      }

      if (span.quote !== currentContent.slice(span.start, span.end)) {
        context.addIssue({
          code: "custom",
          message: "textSpan.quote does not match currentContent slice.",
          path: ["issues", issueIndex, "textSpan", "quote"],
        });
      }
    });
  }).parse(result);
}
