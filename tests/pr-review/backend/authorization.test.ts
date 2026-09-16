import { describe, expect, it } from "@jest/globals";
import type {
  ReviewActor,
  ReviewCase,
  ReviewStage,
} from "../../../src/pr-review/algorithm/index.js";
import { ApiRequestError } from "../../../src/pr-review/backend/api/errors.js";
import {
  allowedActions,
  assertActionAllowed,
  combinedAllowedActions,
} from "../../../src/pr-review/backend/services/authorization.js";

const ts = "2026-09-15T02:00:00.000Z";

function makeCase(stage: ReviewStage, submitterId = "usr_req"): ReviewCase {
  return {
    id: "case_auth_001",
    contentType: "SOCIAL_POST",
    targetPlatform: ["WEIBO"],
    originalContent: "内容",
    currentContent: "内容",
    imageUrls: [],
    submitter: { id: submitterId, displayName: "Submitter" },
    version: 1,
    currentStage: stage,
    createdAt: ts,
    updatedAt: ts,
  };
}

function actor(role: string, id = `usr_${role.toLowerCase()}`): ReviewActor {
  return { id, displayName: role, role };
}

const HUMAN = ["APPROVE", "REVISE", "REJECT", "ESCALATE"];

describe("authorization policy (contracts 12.7.1)", () => {
  it("grants stage-matching roles the four human actions", () => {
    expect(
      allowedActions(makeCase("OPERATOR_REVIEW"), actor("ACCOUNT_OPERATOR")),
    ).toEqual(HUMAN);
    expect(
      allowedActions(makeCase("VISUAL_REVIEW"), actor("VISUAL_REVIEWER")),
    ).toEqual(HUMAN);
    expect(
      allowedActions(
        makeCase("COMPLIANCE_REVIEW"),
        actor("COMPLIANCE_REVIEWER"),
      ),
    ).toEqual(HUMAN);
  });

  it("grants all reviewer roles actions at REVIEW_REQUIRED", () => {
    for (const role of [
      "ACCOUNT_OPERATOR",
      "VISUAL_REVIEWER",
      "COMPLIANCE_REVIEWER",
      "MEDIA_MANAGER",
    ]) {
      expect(allowedActions(makeCase("REVIEW_REQUIRED"), actor(role))).toEqual(
        HUMAN,
      );
    }
  });

  it("denies mismatched roles and administrators", () => {
    expect(
      allowedActions(makeCase("OPERATOR_REVIEW"), actor("COMPLIANCE_REVIEWER")),
    ).toEqual([]);
    expect(
      allowedActions(makeCase("REVIEW_REQUIRED"), actor("REQUESTER")),
    ).toEqual([]);
    expect(
      allowedActions(
        makeCase("MEDIA_MANAGER_APPROVAL"),
        actor("SYSTEM_ADMINISTRATOR"),
      ),
    ).toEqual([]);
  });

  it("denies every action at terminal and system stages", () => {
    for (const stage of [
      "REQUESTER_SELF_CHECK",
      "RISK_ROUTING",
      "COMPLETED",
      "REJECTED",
      "ESCALATED",
    ] as const) {
      expect(
        combinedAllowedActions(makeCase(stage), actor("MEDIA_MANAGER")),
      ).toEqual([]);
    }
  });

  it("forbids the submitter from approving the final gate of their own case", () => {
    const ownCase = makeCase("MEDIA_MANAGER_APPROVAL", "usr_mm");
    const selfActor: ReviewActor = {
      id: "usr_mm",
      displayName: "Manager",
      role: "MEDIA_MANAGER",
    };
    expect(allowedActions(ownCase, selfActor)).toEqual([
      "REVISE",
      "REJECT",
      "ESCALATE",
    ]);

    const otherManager = actor("MEDIA_MANAGER", "usr_other");
    expect(allowedActions(ownCase, otherManager)).toEqual(HUMAN);
  });

  it("exposes SCHEDULE only to media managers at SCHEDULING (not the submitter)", () => {
    const scheduling = makeCase("SCHEDULING", "usr_req");
    expect(combinedAllowedActions(scheduling, actor("MEDIA_MANAGER"))).toEqual([
      "SCHEDULE",
    ]);
    expect(
      combinedAllowedActions(scheduling, actor("ACCOUNT_OPERATOR")),
    ).toEqual([]);

    const ownScheduling = makeCase("SCHEDULING", "usr_mm");
    expect(
      combinedAllowedActions(ownScheduling, {
        id: "usr_mm",
        displayName: "Manager",
        role: "MEDIA_MANAGER",
      }),
    ).toEqual([]);
  });

  it("assertActionAllowed throws FORBIDDEN ApiRequestError", () => {
    try {
      assertActionAllowed(
        makeCase("COMPLIANCE_REVIEW"),
        actor("ACCOUNT_OPERATOR"),
        "APPROVE",
      );
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).code).toBe("FORBIDDEN");
      expect((error as ApiRequestError).status).toBe(403);
    }
    expect(() =>
      assertActionAllowed(
        makeCase("COMPLIANCE_REVIEW"),
        actor("COMPLIANCE_REVIEWER"),
        "APPROVE",
      ),
    ).not.toThrow();
  });

  it("keeps allowedActions consistent with server-side assertion", () => {
    const reviewCase = makeCase("REVIEW_REQUIRED");
    const reviewer = actor("VISUAL_REVIEWER");
    for (const action of allowedActions(reviewCase, reviewer)) {
      expect(() =>
        assertActionAllowed(reviewCase, reviewer, action),
      ).not.toThrow();
    }
    expect(() =>
      assertActionAllowed(
        makeCase("OPERATOR_REVIEW"),
        actor("REQUESTER"),
        "APPROVE",
      ),
    ).toThrow(ApiRequestError);
  });
});
