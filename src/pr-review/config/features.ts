import { ParsedPrReviewEnv } from "./env.js";
import { FeatureConfig } from "./types.js";

export function buildFeatureConfig(env: ParsedPrReviewEnv): FeatureConfig {
  return Object.freeze({
    traceContentEnabled: env.TRACE_CONTENT_ENABLED,
  });
}
