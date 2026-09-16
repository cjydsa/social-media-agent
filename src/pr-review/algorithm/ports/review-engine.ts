import type {
  ResumeReviewInput,
  ReviewContext,
  ReviewEngineInput,
  ReviewEngineOutput,
} from "../schemas/review-engine.js";

export interface ReviewEngine {
  review(
    input: ReviewEngineInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;

  resume(
    input: ResumeReviewInput,
    context: ReviewContext,
  ): Promise<ReviewEngineOutput>;
}
