import type { JsonValue } from "../../algorithm/index.js";
import {
  ApiErrorEnvelopeSchema,
  type ApiErrorCode,
  type ApiErrorEnvelope,
} from "../dto/schemas.js";

export function createApiErrorEnvelope(input: {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, JsonValue> | null;
  requestId?: string | null;
}): ApiErrorEnvelope {
  return ApiErrorEnvelopeSchema.parse({
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? null,
      requestId: input.requestId ?? null,
    },
  });
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details: Record<string, JsonValue> | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
