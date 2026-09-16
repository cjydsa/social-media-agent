import { parsePrReviewEnv, ParsedPrReviewEnv } from "./env.js";
import { buildFeatureConfig } from "./features.js";
import {
  buildLangSmithConfig,
  buildLLMConfig,
  buildRetrievalConfig,
  buildVisualConfig,
} from "./providers.js";
import {
  buildProviderConfigurationStatus,
  buildRoleModelPolicy,
} from "./role-model-policy.js";
import {
  ConfigDiagnostics,
  PrReviewConfig,
  SafePrReviewConfig,
} from "./types.js";

export * from "./env.js";
export * from "./providers.js";
export * from "./role-model-policy.js";
export * from "./types.js";

export function createConfig(env: ParsedPrReviewEnv): PrReviewConfig {
  const isProduction = env.NODE_ENV === "production";
  const realPublishingEnabled =
    isProduction &&
    env.PUBLISHER_MODE === "real" &&
    env.REAL_PUBLISHING_ENABLED;

  return Object.freeze({
    app: Object.freeze({
      environment: env.NODE_ENV,
      apiPort: env.PR_REVIEW_API_PORT,
      maxRevisionCount: env.PR_REVIEW_MAX_REVISION_COUNT,
    }),
    server: Object.freeze({
      host: env.PR_REVIEW_SERVER_HOST,
      uploadDir: env.PR_REVIEW_UPLOAD_DIR,
      authMode: env.PR_REVIEW_AUTH_MODE,
      demoSeed: env.PR_REVIEW_DEMO_SEED,
    }),
    llm: buildLLMConfig(env),
    roleModelPolicy: buildRoleModelPolicy(env),
    providers: buildProviderConfigurationStatus(env),
    langsmith: buildLangSmithConfig(env),
    retrieval: buildRetrievalConfig(env),
    visual: buildVisualConfig(env),
    publisher: Object.freeze({
      mode: env.PUBLISHER_MODE,
      requestedRealPublishingEnabled: env.REAL_PUBLISHING_ENABLED,
      realPublishingEnabled,
    }),
    evaluation: Object.freeze({ datasetPath: env.EVAL_DATASET_PATH }),
    features: buildFeatureConfig(env),
  });
}

export function loadConfig(
  source?: Readonly<Record<string, string | undefined>>,
): PrReviewConfig {
  return createConfig(parsePrReviewEnv(source));
}

export const config = loadConfig();

export function getSafeConfig(
  candidate: PrReviewConfig = config,
): SafePrReviewConfig {
  return {
    app: candidate.app,
    server: candidate.server,
    llm: {
      provider: candidate.llm.provider,
      model: candidate.llm.model,
      baseUrl: candidate.llm.baseUrl,
      apiKeyConfigured: candidate.llm.apiKey?.isConfigured() ?? false,
    },
    roleModelPolicy: candidate.roleModelPolicy,
    providers: candidate.providers,
    langsmith: {
      tracingEnabled: candidate.langsmith.tracingEnabled,
      project: candidate.langsmith.project,
      apiKeyConfigured: candidate.langsmith.apiKey?.isConfigured() ?? false,
    },
    retrieval: {
      provider: candidate.retrieval.provider,
      firecrawlApiKeyConfigured:
        candidate.retrieval.firecrawlApiKey?.isConfigured() ?? false,
    },
    visual: candidate.visual,
    publisher: candidate.publisher,
    evaluation: candidate.evaluation,
    features: candidate.features,
  };
}

export function getConfigDiagnostics(
  candidate: PrReviewConfig = config,
): ConfigDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (candidate.llm.provider !== "mock") {
    if (!candidate.llm.apiKey?.isConfigured()) {
      const variable = {
        deepseek: "DEEPSEEK_API_KEY",
        qwen: "DASHSCOPE_API_KEY",
        openai: "OPENAI_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
      }[candidate.llm.provider];
      errors.push(`LLM provider requires ${variable}.`);
    }
    if (!candidate.llm.model) {
      errors.push("A non-mock LLM provider requires LLM_MODEL.");
    }
    if (candidate.llm.provider === "qwen" && !candidate.llm.baseUrl) {
      errors.push("Qwen provider requires QWEN_BASE_URL.");
    }
  }

  if (
    candidate.langsmith.tracingEnabled &&
    !candidate.langsmith.apiKey?.isConfigured()
  ) {
    const message =
      "LangSmith tracing is enabled but LANGSMITH_API_KEY is missing.";
    if (candidate.app.environment === "production") errors.push(message);
    else
      warnings.push(
        `${message} Tracing will not be usable in this environment.`,
      );
  }

  if (candidate.roleModelPolicy.executionMode !== "mock") {
    const roles = [
      "planner",
      "specialist",
      "critic",
      "judge",
      "revision",
    ] as const;
    for (const role of roles) {
      const selection = candidate.roleModelPolicy[role];
      if (selection.provider === "mock") continue;
      if (!selection.model) {
        errors.push(`${role} role requires a model in non-mock execution.`);
      }
      const configured = {
        deepseek: candidate.providers.deepseekConfigured,
        qwen: candidate.providers.qwenConfigured,
        openai: candidate.providers.openaiConfigured,
        anthropic: candidate.providers.anthropicConfigured,
      }[selection.provider];
      if (!configured) {
        errors.push(
          `${role} role provider ${selection.provider} is missing its API key.`,
        );
      }
      if (
        selection.provider === "qwen" &&
        !candidate.providers.qwenBaseUrlConfigured
      ) {
        errors.push(`${role} role provider qwen requires QWEN_BASE_URL.`);
      }
    }
  }

  if (
    candidate.app.environment !== "production" &&
    (candidate.publisher.mode === "real" ||
      candidate.publisher.requestedRealPublishingEnabled)
  ) {
    warnings.push(
      "Real publishing was requested outside production and has been forcibly disabled.",
    );
  }

  if (
    candidate.visual.enabled &&
    candidate.visual.provider === "same-as-llm" &&
    candidate.llm.provider === "mock"
  ) {
    errors.push(
      "VISUAL_PROVIDER=same-as-llm requires a non-mock LLM provider when visual review is enabled.",
    );
  }

  return { errors, warnings };
}
