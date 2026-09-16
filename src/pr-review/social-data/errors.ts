import type { JsonValue } from "../algorithm/index.js";

export const SocialDataErrorCodes = [
  "MALFORMED_INPUT",
  "PROVIDER_UNAVAILABLE",
  "INVALID_ACCESS_MODE",
  "INVALID_PLATFORM",
  "NORMALIZATION_FAILED",
] as const;

export type SocialDataErrorCode = (typeof SocialDataErrorCodes)[number];

export class SocialDataError extends Error {
  constructor(
    public readonly code: SocialDataErrorCode,
    message: string,
    public readonly details: Record<string, JsonValue> | null = null,
  ) {
    super(message);
    this.name = "SocialDataError";
  }
}
