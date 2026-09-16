import type { ParsedPrReviewEnv } from "./env.js";
import type {
  LLMProvider,
  ProviderConfigurationStatus,
  ReviewAgentRole,
  RoleModelPolicyConfig,
  RoleModelSelectionConfig,
} from "./types.js";

const roleFields = {
  planner: ["PR_REVIEW_PLANNER_PROVIDER", "PR_REVIEW_PLANNER_MODEL"],
  specialist: ["PR_REVIEW_SPECIALIST_PROVIDER", "PR_REVIEW_SPECIALIST_MODEL"],
  critic: ["PR_REVIEW_CRITIC_PROVIDER", "PR_REVIEW_CRITIC_MODEL"],
  judge: ["PR_REVIEW_JUDGE_PROVIDER", "PR_REVIEW_JUDGE_MODEL"],
  revision: ["PR_REVIEW_REVISION_PROVIDER", "PR_REVIEW_REVISION_MODEL"],
} as const satisfies Record<
  ReviewAgentRole,
  readonly [keyof ParsedPrReviewEnv, keyof ParsedPrReviewEnv]
>;

function buildSelection(
  env: ParsedPrReviewEnv,
  role: ReviewAgentRole,
): RoleModelSelectionConfig {
  const [providerKey, modelKey] = roleFields[role];
  return Object.freeze({
    provider: (env[providerKey] ?? env.LLM_PROVIDER) as LLMProvider,
    model: (env[modelKey] ?? env.LLM_MODEL ?? null) as string | null,
  });
}

export function buildRoleModelPolicy(
  env: ParsedPrReviewEnv,
): RoleModelPolicyConfig {
  return Object.freeze({
    executionMode: env.PR_REVIEW_EXECUTION_MODE,
    planner: buildSelection(env, "planner"),
    specialist: buildSelection(env, "specialist"),
    critic: buildSelection(env, "critic"),
    judge: buildSelection(env, "judge"),
    revision: buildSelection(env, "revision"),
  });
}

export function buildProviderConfigurationStatus(
  env: ParsedPrReviewEnv,
): ProviderConfigurationStatus {
  return Object.freeze({
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    qwenConfigured: Boolean(env.DASHSCOPE_API_KEY),
    qwenBaseUrlConfigured: Boolean(env.QWEN_BASE_URL),
    openaiConfigured: Boolean(env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY),
  });
}
