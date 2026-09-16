import type { ReviewEngineInput } from "../schemas/review-engine.js";

export const REVIEW_SCENARIOS = [
  "normal",
  "pr-risk",
  "operations-risk",
  "product-risk",
  "customer-risk",
  "compliance-risk",
  "multi-risk",
  "missing-evidence",
  "reviewer-conflict",
  "reviewer-failure",
] as const;

export type ReviewScenario = (typeof REVIEW_SCENARIOS)[number];
export type ReviewScenarioResolver = (
  input: ReviewEngineInput,
) => ReviewScenario;

export const defaultScenarioResolver: ReviewScenarioResolver = (input) => {
  const marker = input.currentContent.match(/\[scenario:([a-z-]+)\]/i)?.[1];
  return REVIEW_SCENARIOS.includes(marker as ReviewScenario)
    ? (marker as ReviewScenario)
    : "normal";
};
