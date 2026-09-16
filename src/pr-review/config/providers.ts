import { ParsedPrReviewEnv } from "./env.js";
import {
  LLMConfig,
  LangSmithConfig,
  RetrievalConfig,
  SecretValue,
  VisualConfig,
} from "./types.js";

function secret(value: string | undefined): SecretValue | null {
  return value ? new SecretValue(value) : null;
}

export function buildLLMConfig(env: ParsedPrReviewEnv): LLMConfig {
  const selectedKey = {
    mock: undefined,
    deepseek: env.DEEPSEEK_API_KEY,
    qwen: env.DASHSCOPE_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  }[env.LLM_PROVIDER];

  return Object.freeze({
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL ?? null,
    apiKey: secret(selectedKey),
    baseUrl: env.LLM_PROVIDER === "qwen" ? (env.QWEN_BASE_URL ?? null) : null,
  });
}

/**
 * Build an LLMConfig for an arbitrary role selection (SPRINT-006 hybrid
 * runtime). Secrets are resolved per provider exactly like buildLLMConfig;
 * this stays the only secret-resolution path.
 */
export function buildLLMConfigForSelection(
  env: ParsedPrReviewEnv,
  selection: { provider: LLMConfig["provider"]; model: string | null },
): LLMConfig {
  const selectedKey = {
    mock: undefined,
    deepseek: env.DEEPSEEK_API_KEY,
    qwen: env.DASHSCOPE_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  }[selection.provider];

  return Object.freeze({
    provider: selection.provider,
    model: selection.model,
    apiKey: secret(selectedKey),
    baseUrl: selection.provider === "qwen" ? (env.QWEN_BASE_URL ?? null) : null,
  });
}

/**
 * Build the vision (image analysis) LLMConfig (SPRINT-006). Qwen defaults
 * to qwen-vl-plus when no explicit model is configured; secrets reuse the
 * DashScope key of the qwen provider.
 */
export function buildVisionLLMConfig(env: ParsedPrReviewEnv): LLMConfig | null {
  if (env.PR_REVIEW_VISION_PROVIDER === "mock") return null;
  const baseUrl = env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  return Object.freeze({
    provider: "qwen" as const,
    model: env.PR_REVIEW_VISION_MODEL ?? "qwen-vl-plus",
    apiKey: secret(env.DASHSCOPE_API_KEY),
    baseUrl,
  });
}

export function buildLangSmithConfig(env: ParsedPrReviewEnv): LangSmithConfig {
  return Object.freeze({
    tracingEnabled: env.LANGSMITH_TRACING,
    project: env.LANGSMITH_PROJECT,
    apiKey: secret(env.LANGSMITH_API_KEY),
  });
}

export function buildRetrievalConfig(env: ParsedPrReviewEnv): RetrievalConfig {
  return Object.freeze({
    provider: env.RETRIEVAL_PROVIDER,
    firecrawlApiKey: secret(env.FIRECRAWL_API_KEY),
  });
}

export function buildVisualConfig(env: ParsedPrReviewEnv): VisualConfig {
  return Object.freeze({
    enabled: env.VISUAL_REVIEW_ENABLED,
    provider: env.VISUAL_PROVIDER,
  });
}

export function assertLLMConfigured(llm: LLMConfig): void {
  if (llm.provider === "mock") return;

  if (!llm.apiKey?.isConfigured()) {
    const variable = {
      deepseek: "DEEPSEEK_API_KEY",
      qwen: "DASHSCOPE_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    }[llm.provider];
    throw new Error(
      `LLM_PROVIDER=${llm.provider} requires ${variable} before a review model can be created.`,
    );
  }

  if (!llm.model) {
    throw new Error(
      `LLM_PROVIDER=${llm.provider} requires LLM_MODEL before a review model can be created.`,
    );
  }

  if (llm.provider === "qwen" && !llm.baseUrl) {
    throw new Error(
      "LLM_PROVIDER=qwen requires QWEN_BASE_URL before a review model can be created.",
    );
  }
}
