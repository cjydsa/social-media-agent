import { z } from "zod";
import {
  ReviewFailureSchema,
  type ReviewFailure,
} from "../schemas/review-engine.js";

export interface StructuredOutputRunnable {
  invoke(input: unknown): Promise<unknown>;
}

export interface StructuredOutputModel {
  withStructuredOutput(schema: z.ZodTypeAny): StructuredOutputRunnable;
}

export interface InvokeStructuredOutputInput<T> {
  model: StructuredOutputModel;
  schema: z.ZodType<T>;
  input: unknown;
  retries?: number;
  failureSource?: ReviewFailure["source"];
}

export class StructuredAgentError extends Error {
  constructor(public readonly failure: ReviewFailure) {
    super(failure.message);
    this.name = "StructuredAgentError";
  }
}

function failureFromError(
  error: unknown,
  source: ReviewFailure["source"],
): ReviewFailure {
  const message = error instanceof Error ? error.message : "unknown error";
  const isTimeout = /timeout|aborted/i.test(message);
  return ReviewFailureSchema.parse({
    code: isTimeout ? "TIMEOUT" : "SCHEMA_VALIDATION_FAILED",
    message: isTimeout
      ? "LLM structured output timed out."
      : "LLM structured output failed schema validation.",
    retryable: isTimeout,
    source,
    details: { reason: message },
  });
}

export async function invokeStructuredOutput<T>(
  input: InvokeStructuredOutputInput<T>,
): Promise<T> {
  const attempts = (input.retries ?? 1) + 1;
  let lastFailure: ReviewFailure | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const raw = await input.model
        .withStructuredOutput(input.schema)
        .invoke(input.input);
      const parsed = input.schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      lastFailure = failureFromError(
        parsed.error,
        input.failureSource ?? "MODEL",
      );
    } catch (error) {
      lastFailure = failureFromError(error, input.failureSource ?? "MODEL");
    }
  }

  throw new StructuredAgentError(
    lastFailure ??
      ReviewFailureSchema.parse({
        code: "INTERNAL_ERROR",
        message: "LLM structured output failed without diagnostic.",
        retryable: false,
        source: input.failureSource ?? "MODEL",
        details: null,
      }),
  );
}
