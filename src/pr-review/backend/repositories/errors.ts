import type { JsonValue } from "../../algorithm/index.js";

export const RepositoryErrorCodes = [
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "DUPLICATE_RECORD",
  "TRANSACTION_FAILED",
  "INVALID_STATE",
] as const;

export type RepositoryErrorCode = (typeof RepositoryErrorCodes)[number];

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    public readonly details: Record<string, JsonValue> | null = null,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
