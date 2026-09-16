import {
  ConfigDiagnostics,
  PrReviewConfig,
  SafePrReviewConfig,
} from "./types.js";
import { getConfigDiagnostics, getSafeConfig } from "./index.js";

function configured(value: boolean): string {
  return value ? "configured" : "missing";
}

function enabled(value: boolean): string {
  return value ? "enabled" : "disabled";
}

export function formatConfigDoctorReport(candidate: PrReviewConfig): {
  output: string;
  diagnostics: ConfigDiagnostics;
} {
  const safe: SafePrReviewConfig = getSafeConfig(candidate);
  const diagnostics = getConfigDiagnostics(candidate);
  const result = diagnostics.errors.length
    ? "configuration invalid"
    : "configuration valid";
  const warningLines = diagnostics.warnings.map(
    (warning) => `  warning: ${warning}`,
  );
  const errorLines = diagnostics.errors.map((error) => `  error: ${error}`);

  const output = [
    "PR Review Configuration",
    "",
    `Environment: ${safe.app.environment}`,
    "",
    "LLM:",
    `  provider: ${safe.llm.provider}`,
    `  model: ${configured(Boolean(safe.llm.model))}`,
    `  api key: ${configured(safe.llm.apiKeyConfigured)}`,
    ...(safe.llm.provider === "qwen"
      ? [`  base URL: ${configured(Boolean(safe.llm.baseUrl))}`]
      : []),
    "",
    "LangSmith:",
    `  tracing: ${enabled(safe.langsmith.tracingEnabled)}`,
    `  api key: ${configured(safe.langsmith.apiKeyConfigured)}`,
    "",
    "Retrieval:",
    `  provider: ${safe.retrieval.provider}`,
    "",
    "Visual:",
    `  enabled: ${safe.visual.enabled}`,
    `  provider: ${safe.visual.provider}`,
    "",
    "Publisher:",
    `  mode: ${safe.publisher.mode}`,
    `  real publishing: ${safe.publisher.realPublishingEnabled ? "ENABLED" : "DISABLED"}`,
    "",
    "Result:",
    `  ${result}`,
    ...warningLines,
    ...errorLines,
  ].join("\n");

  return { output, diagnostics };
}
