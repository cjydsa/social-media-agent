import { AIMessage } from "@langchain/core/messages";
import { config, getConfigDiagnostics } from "../src/pr-review/config/index.js";
import { LLMProvider } from "../src/pr-review/config/types.js";
import { createReviewModel } from "../src/pr-review/algorithm/providers/index.js";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function extractTokenUsage(message: AIMessage): TokenUsage | null {
  const usage = message.usage_metadata;
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

function printResult(fields: {
  provider: LLMProvider;
  model: string | null;
  success: boolean;
  latencyMs: number;
  tokenUsage: TokenUsage | null;
}): void {
  console.log(`provider: ${fields.provider}`);
  console.log(`model: ${fields.model ?? "missing"}`);
  console.log(`success: ${fields.success}`);
  console.log(`latency: ${fields.latencyMs}ms`);
  console.log(
    `token usage: ${fields.tokenUsage ? JSON.stringify(fields.tokenUsage) : "unavailable"}`,
  );
}

export async function runProviderSmoke(expectedProvider: LLMProvider) {
  const startedAt = Date.now();
  const diagnostics = getConfigDiagnostics(config);
  if (
    config.llm.provider !== expectedProvider ||
    diagnostics.errors.length > 0
  ) {
    printResult({
      provider: expectedProvider,
      model: config.llm.model,
      success: false,
      latencyMs: Date.now() - startedAt,
      tokenUsage: null,
    });
    process.exitCode = 1;
    return;
  }

  try {
    const model = createReviewModel(config.llm);
    const response = await model.invoke([
      ["system", "Return only the requested short acknowledgement."],
      ["human", "Reply with OK."],
    ]);
    printResult({
      provider: expectedProvider,
      model: config.llm.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      tokenUsage: extractTokenUsage(response),
    });
  } catch (_error) {
    printResult({
      provider: expectedProvider,
      model: config.llm.model,
      success: false,
      latencyMs: Date.now() - startedAt,
      tokenUsage: null,
    });
    process.exitCode = 1;
  }
}
