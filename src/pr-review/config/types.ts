const REDACTED = "[REDACTED]";
const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

export type AppEnvironment = "development" | "test" | "production";
export type LLMProvider = "mock" | "deepseek" | "qwen" | "openai" | "anthropic";
export type ReviewExecutionMode = "mock" | "hybrid" | "real";
export type ReviewAgentRole =
  "planner" | "specialist" | "critic" | "judge" | "revision";
export type RetrievalProvider = "local";
export type VisualProvider = "mock" | "same-as-llm";
export type PublisherMode = "mock" | "real";

/**
 * A secret wrapper that redacts string, JSON, and Node.js inspection output.
 * Provider adapters may unwrap it only at the point where a credential is sent
 * to the provider SDK.
 */
export class SecretValue {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  isConfigured(): boolean {
    return this.#value.length > 0;
  }

  unwrap(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspectSymbol](): string {
    return REDACTED;
  }
}

export interface AppConfig {
  environment: AppEnvironment;
  apiPort: number;
  maxRevisionCount: number;
}

export type AuthMode = "dev-header";
export type VisionProvider = "mock" | "qwen";

export interface ServerConfig {
  host: string;
  uploadDir: string;
  authMode: AuthMode;
  demoSeed: boolean;
}

export interface VisionConfig {
  provider: VisionProvider;
  model: string | null;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string | null;
  apiKey: SecretValue | null;
  /** Required only by OpenAI-compatible providers whose endpoint is regional. */
  baseUrl: string | null;
}

export interface RoleModelSelectionConfig {
  provider: LLMProvider;
  model: string | null;
}

export type RoleModelPolicyConfig = Readonly<
  Record<ReviewAgentRole, RoleModelSelectionConfig>
> & {
  executionMode: ReviewExecutionMode;
};

export interface ProviderConfigurationStatus {
  deepseekConfigured: boolean;
  qwenConfigured: boolean;
  qwenBaseUrlConfigured: boolean;
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
}

export interface LangSmithConfig {
  tracingEnabled: boolean;
  project: string;
  apiKey: SecretValue | null;
}

export interface RetrievalConfig {
  provider: RetrievalProvider;
  firecrawlApiKey: SecretValue | null;
}

export interface VisualConfig {
  enabled: boolean;
  provider: VisualProvider;
}

export interface PublisherConfig {
  mode: PublisherMode;
  requestedRealPublishingEnabled: boolean;
  /** Effective permission. Always false outside production. */
  realPublishingEnabled: boolean;
}

export interface EvaluationConfig {
  datasetPath: string;
}

export interface FeatureConfig {
  traceContentEnabled: boolean;
}

export interface PrReviewConfig {
  app: AppConfig;
  server: ServerConfig;
  vision: VisionConfig;
  llm: LLMConfig;
  roleModelPolicy: RoleModelPolicyConfig;
  providers: ProviderConfigurationStatus;
  langsmith: LangSmithConfig;
  retrieval: RetrievalConfig;
  visual: VisualConfig;
  publisher: PublisherConfig;
  evaluation: EvaluationConfig;
  features: FeatureConfig;
}

export interface SafePrReviewConfig {
  app: AppConfig;
  server: ServerConfig;
  vision: VisionConfig;
  llm: Omit<LLMConfig, "apiKey"> & { apiKeyConfigured: boolean };
  roleModelPolicy: RoleModelPolicyConfig;
  providers: ProviderConfigurationStatus;
  langsmith: Omit<LangSmithConfig, "apiKey"> & {
    apiKeyConfigured: boolean;
  };
  retrieval: Omit<RetrievalConfig, "firecrawlApiKey"> & {
    firecrawlApiKeyConfigured: boolean;
  };
  visual: VisualConfig;
  publisher: PublisherConfig;
  evaluation: EvaluationConfig;
  features: FeatureConfig;
}

export interface ConfigDiagnostics {
  errors: string[];
  warnings: string[];
}
