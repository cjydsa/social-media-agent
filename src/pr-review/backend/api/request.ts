import { z } from "zod";
import type { ApiErrorEnvelope } from "../dto/schemas.js";
import { ApiRequestError, createApiErrorEnvelope } from "./errors.js";

export const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

export interface JsonRequestInput {
  contentType: string | null | undefined;
  body: string;
  maxBytes?: number;
}

function isJsonContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().split(";")[0]?.trim() === "application/json";
}

export function parseJsonRequest<T>(
  schema: z.ZodType<T>,
  input: JsonRequestInput,
): T {
  if (!isJsonContentType(input.contentType)) {
    throw new ApiRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
      415,
    );
  }

  const maxBytes = input.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  if (Buffer.byteLength(input.body, "utf8") > maxBytes) {
    throw new ApiRequestError(
      "PAYLOAD_TOO_LARGE",
      "Request body exceeds the configured size limit.",
      413,
      { maxBytes },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.body);
  } catch {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "Request body is not JSON.",
      400,
    );
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "Request body failed schema validation.",
      400,
      { issues: parsed.error.issues.map((issue) => issue.message) },
    );
  }

  return parsed.data;
}

export function toApiErrorEnvelope(
  error: unknown,
  requestId: string | null = null,
): { status: number; body: ApiErrorEnvelope } {
  if (error instanceof ApiRequestError) {
    return {
      status: error.status,
      body: createApiErrorEnvelope({
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      }),
    };
  }

  return {
    status: 500,
    body: createApiErrorEnvelope({
      code: "INTERNAL_ERROR",
      message: "Internal PR Review API error.",
      requestId,
    }),
  };
}
