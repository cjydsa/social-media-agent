import type {
  ReviewActionType,
  ReviewActor,
  ReviewCase,
  ReviewStage,
} from "../../algorithm/index.js";
import { ApiRequestError } from "../api/errors.js";
import type { ActorRole } from "../auth/dev-header.js";

const HUMAN_ACTIONS = [
  "APPROVE",
  "REVISE",
  "REJECT",
  "ESCALATE",
] as const satisfies readonly ReviewActionType[];

type HumanAction = (typeof HUMAN_ACTIONS)[number];

/**
 * Role x stage action matrix (contracts 12.7.1). This is the single
 * enforcement point; allowedActions exposed to the Frontend must match
 * what assertActionAllowed accepts.
 */
const STAGE_ROLE_ACTIONS: Readonly<
  Partial<Record<ReviewStage, Readonly<Record<string, readonly HumanAction[]>>>>
> = {
  OPERATOR_REVIEW: {
    ACCOUNT_OPERATOR: HUMAN_ACTIONS,
  },
  VISUAL_REVIEW: {
    VISUAL_REVIEWER: HUMAN_ACTIONS,
  },
  COMPLIANCE_REVIEW: {
    COMPLIANCE_REVIEWER: HUMAN_ACTIONS,
  },
  REVIEW_REQUIRED: {
    ACCOUNT_OPERATOR: HUMAN_ACTIONS,
    VISUAL_REVIEWER: HUMAN_ACTIONS,
    COMPLIANCE_REVIEWER: HUMAN_ACTIONS,
    MEDIA_MANAGER: HUMAN_ACTIONS,
  },
  MEDIA_MANAGER_APPROVAL: {
    MEDIA_MANAGER: HUMAN_ACTIONS,
  },
  SCHEDULING: {
    MEDIA_MANAGER: ["APPROVE"],
  },
};

function asRole(actor: ReviewActor): ActorRole | null {
  const role = actor.role.trim();
  const roles: readonly ActorRole[] = [
    "REQUESTER",
    "ACCOUNT_OPERATOR",
    "VISUAL_REVIEWER",
    "COMPLIANCE_REVIEWER",
    "MEDIA_MANAGER",
    "SYSTEM_ADMINISTRATOR",
  ];
  return (roles as readonly string[]).includes(role)
    ? (role as ActorRole)
    : null;
}

export function allowedActions(
  reviewCase: ReviewCase,
  actor: ReviewActor,
): ReviewActionType[] {
  const role = asRole(actor);
  if (!role || role === "SYSTEM_ADMINISTRATOR") return [];

  const stagePolicy = STAGE_ROLE_ACTIONS[reviewCase.currentStage];
  const actions = stagePolicy?.[role] ?? [];

  return actions.filter((action) => {
    if (reviewCase.currentStage === "SCHEDULING" && action === "APPROVE") {
      // SCHEDULING stage exposes the SCHEDULE action, not APPROVE.
      return false;
    }
    // A submitter must never approve the final gate of their own case.
    if (
      reviewCase.currentStage === "MEDIA_MANAGER_APPROVAL" &&
      action === "APPROVE" &&
      reviewCase.submitter.id === actor.id
    ) {
      return false;
    }
    return true;
  });
}

export function allowedScheduleActions(
  reviewCase: ReviewCase,
  actor: ReviewActor,
): ReviewActionType[] {
  const role = asRole(actor);
  if (reviewCase.currentStage !== "SCHEDULING") return [];
  if (role !== "MEDIA_MANAGER") return [];
  if (reviewCase.submitter.id === actor.id) return [];
  return ["SCHEDULE"];
}

export function combinedAllowedActions(
  reviewCase: ReviewCase,
  actor: ReviewActor,
): ReviewActionType[] {
  return [
    ...allowedActions(reviewCase, actor),
    ...allowedScheduleActions(reviewCase, actor),
  ];
}

export function assertActionAllowed(
  reviewCase: ReviewCase,
  actor: ReviewActor,
  action: ReviewActionType,
): void {
  const allowed =
    action === "SCHEDULE"
      ? allowedScheduleActions(reviewCase, actor)
      : allowedActions(reviewCase, actor);

  if (!allowed.includes(action)) {
    throw new ApiRequestError(
      "FORBIDDEN",
      `Actor role ${actor.role} may not perform ${action} at stage ${reviewCase.currentStage}.`,
      403,
      {
        stage: reviewCase.currentStage,
        role: actor.role,
        action,
      },
    );
  }
}

export function assertStageAction(
  reviewCase: ReviewCase,
  action: ReviewActionType,
): void {
  const actionableStages: readonly ReviewStage[] = [
    "OPERATOR_REVIEW",
    "VISUAL_REVIEW",
    "COMPLIANCE_REVIEW",
    "REVIEW_REQUIRED",
    "MEDIA_MANAGER_APPROVAL",
  ];

  if (action === "SCHEDULE") {
    if (reviewCase.currentStage !== "SCHEDULING") {
      throw new ApiRequestError(
        "INVALID_STAGE_ACTION",
        `SCHEDULE is only executable at stage SCHEDULING.`,
        422,
        { stage: reviewCase.currentStage, action },
      );
    }
    return;
  }

  if (!actionableStages.includes(reviewCase.currentStage)) {
    throw new ApiRequestError(
      "INVALID_STAGE_ACTION",
      `Action ${action} is not executable at stage ${reviewCase.currentStage}.`,
      422,
      { stage: reviewCase.currentStage, action },
    );
  }
}
