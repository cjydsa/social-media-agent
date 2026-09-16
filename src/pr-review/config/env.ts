import { z } from "zod";

const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.url().optional(),
);

const optionalProvider = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.enum(["mock", "deepseek", "qwen", "openai", "anthropic"]).optional(),
);

function booleanValue(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      if (value.trim() === "") return undefined;
    }
    return value;
  }, z.boolean().default(defaultValue));
}

function integerValue(defaultValue: number, minimum: number, maximum: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number().int().min(minimum).max(maximum).default(defaultValue),
  );
}

export const prReviewEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    LLM_PROVIDER: z
      .enum(["mock", "deepseek", "qwen", "openai", "anthropic"])
      .default("mock"),
    LLM_MODEL: optionalString,
    PR_REVIEW_EXECUTION_MODE: z
      .enum(["mock", "hybrid", "real"])
      .default("mock"),
    PR_REVIEW_PLANNER_PROVIDER: optionalProvider,
    PR_REVIEW_PLANNER_MODEL: optionalString,
    PR_REVIEW_SPECIALIST_PROVIDER: optionalProvider,
    PR_REVIEW_SPECIALIST_MODEL: optionalString,
    PR_REVIEW_CRITIC_PROVIDER: optionalProvider,
    PR_REVIEW_CRITIC_MODEL: optionalString,
    PR_REVIEW_JUDGE_PROVIDER: optionalProvider,
    PR_REVIEW_JUDGE_MODEL: optionalString,
    PR_REVIEW_REVISION_PROVIDER: optionalProvider,
    PR_REVIEW_REVISION_MODEL: optionalString,
    OPENAI_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    DEEPSEEK_API_KEY: optionalString,
    DASHSCOPE_API_KEY: optionalString,
    QWEN_BASE_URL: optionalUrl,
    LANGSMITH_API_KEY: optionalString,
    LANGSMITH_TRACING: booleanValue(false),
    LANGSMITH_PROJECT: z
      .string()
      .trim()
      .min(1)
      .default("pr-content-review-agent"),
    RETRIEVAL_PROVIDER: z.enum(["local"]).default("local"),
    FIRECRAWL_API_KEY: optionalString,
    VISUAL_REVIEW_ENABLED: booleanValue(false),
    VISUAL_PROVIDER: z.enum(["mock", "same-as-llm"]).default("mock"),
    PUBLISHER_MODE: z.enum(["mock", "real"]).default("mock"),
    REAL_PUBLISHING_ENABLED: booleanValue(false),
    PR_REVIEW_API_PORT: integerValue(3001, 1, 65535),
    PR_REVIEW_SERVER_HOST: z.string().trim().min(1).default("127.0.0.1"),
    PR_REVIEW_UPLOAD_DIR: z.string().trim().min(1).default("data/uploads"),
    PR_REVIEW_AUTH_MODE: z.enum(["dev-header"]).default("dev-header"),
    PR_REVIEW_DEMO_SEED: booleanValue(true),
    PR_REVIEW_VISION_PROVIDER: z.enum(["mock", "qwen"]).default("mock"),
    PR_REVIEW_VISION_MODEL: optionalString,
    PR_REVIEW_MAX_REVISION_COUNT: integerValue(3, 1, 100),
    EVAL_DATASET_PATH: z.string().trim().min(1).default("evals/pr-review/data"),
    TRACE_CONTENT_ENABLED: booleanValue(false),
  })
  .readonly();

export type ParsedPrReviewEnv = z.infer<typeof prReviewEnvSchema>;
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/** The only PR Review module allowed to read process.env directly. */
export function parsePrReviewEnv(
  source: EnvironmentSource = process.env,
): ParsedPrReviewEnv {
  return prReviewEnvSchema.parse(source);
}
