import { assertLLMConfigured } from "../../config/providers.js";
import { LLMConfig } from "../../config/types.js";
import { createDeepSeekModel, DeepSeekSDKFactory } from "./deepseek.js";
import { createMockReviewModel } from "./mock.js";
import { createQwenModel, QwenSDKFactory } from "./qwen.js";
import { ReviewModel } from "./types.js";

export * from "./types.js";

export interface ReviewModelFactoryDependencies {
  deepseekSDKFactory?: DeepSeekSDKFactory;
  qwenSDKFactory?: QwenSDKFactory;
  mockFactory?: () => ReviewModel;
}

/** The only model construction entry point for PR Review reviewers. */
export function createReviewModel(
  llm: LLMConfig,
  dependencies: ReviewModelFactoryDependencies = {},
): ReviewModel {
  switch (llm.provider) {
    case "mock":
      return (dependencies.mockFactory ?? createMockReviewModel)();
    case "deepseek":
      return createDeepSeekModel(llm, dependencies.deepseekSDKFactory);
    case "qwen":
      return createQwenModel(llm, dependencies.qwenSDKFactory);
    case "openai":
    case "anthropic":
      assertLLMConfigured(llm);
      throw new Error(
        `The ${llm.provider} review model adapter is not implemented in INFRA-002.`,
      );
  }
}
