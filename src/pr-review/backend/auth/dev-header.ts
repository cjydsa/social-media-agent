import { ReviewActorSchema, type ReviewActor } from "../../algorithm/index.js";
import { ApiRequestError } from "../api/errors.js";

export const ACTOR_ID_HEADER = "x-actor-id";
export const ACTOR_NAME_HEADER = "x-actor-name";
export const ACTOR_ROLE_HEADER = "x-actor-role";

export const ACTOR_ROLES = [
  "REQUESTER",
  "ACCOUNT_OPERATOR",
  "VISUAL_REVIEWER",
  "COMPLIANCE_REVIEWER",
  "MEDIA_MANAGER",
  "SYSTEM_ADMINISTRATOR",
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export function isActorRole(value: string): value is ActorRole {
  return (ACTOR_ROLES as readonly string[]).includes(value);
}

export interface ActorHeaderInput {
  id: string | null | undefined;
  displayName: string | null | undefined;
  role: string | null | undefined;
}

/**
 * Development identity provider (PR_REVIEW_AUTH_MODE=dev-header).
 * This is NOT a production security boundary; it only exists so the
 * full-stack console can exercise role-based authorization locally.
 */
export function parseActorFromHeaders(input: ActorHeaderInput): ReviewActor {
  const id = input.id?.trim() ?? "";
  const displayName = input.displayName?.trim() ?? "";
  const role = input.role?.trim() ?? "";

  if (!id || !displayName || !role) {
    throw new ApiRequestError(
      "UNAUTHORIZED",
      "Missing actor identity headers (x-actor-id, x-actor-name, x-actor-role).",
      401,
    );
  }
  if (!isActorRole(role)) {
    throw new ApiRequestError("UNAUTHORIZED", "Unknown actor role.", 401, {
      role,
    });
  }

  return ReviewActorSchema.parse({ id, displayName, role });
}
