import { describe, expect, it } from "@jest/globals";
import { createLangGraphReviewEngine } from "../../../src/pr-review/algorithm/engine/langgraph-review-engine.js";
import type {
  ReviewEngine,
  ReviewEngineOutput,
} from "../../../src/pr-review/algorithm/index.js";
import { ApiRequestError } from "../../../src/pr-review/backend/api/errors.js";
import { InMemoryReviewRepository } from "../../../src/pr-review/backend/repositories/in-memory.js";
import { MockPublisher } from "../../../src/pr-review/backend/publishers/mock-publisher.js";
import {
  ReviewOrchestrationService,
  type ReviewRepositories,
} from "../../../src/pr-review/backend/services/orchestration.js";

const REQUESTER = { id: "usr_req", displayName: "Req", role: "REQUESTER" };
const OPERATOR = { id: "usr_op", displayName: "Op", role: "ACCOUNT_OPERATOR" };
const COMPLIANCE = {
  id: "usr_cp",
  displayName: "Cp",
  role: "COMPLIANCE_REVIEWER",
};
const MANAGER = { id: "usr_mm", displayName: "Mm", role: "MEDIA_MANAGER" };

function createService(engine?: ReviewEngine) {
  const repository = new InMemoryReviewRepository();
  const repositories: ReviewRepositories = {
    cases: repository,
    versions: repository,
    results: repository,
    evidence: repository,
    actions: repository,
    revisions: repository,
  };
  const service = new ReviewOrchestrationService({
    repositories,
    engine: engine ?? createLangGraphReviewEngine(),
    publisher: new MockPublisher(),
  });
  return { service, repository };
}

function createInput(content: string) {
  return {
    contentType: "SOCIAL_POST" as const,
    targetPlatform: ["WEIBO"],
    content,
    imageUrls: [],
    sourceUrls: [],
  };
}

describe("ReviewOrchestrationService", () => {
  it("creates a case and auto-routes PASS to SCHEDULING", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("一条普通的新品动态。"),
      REQUESTER,
    );
    expect(detail.case.version).toBe(1);
    expect(detail.case.currentStage).toBe("SCHEDULING");
    expect(detail.latestResult?.finalDecision?.decision).toBe("PASS");
  });

  it("fails closed to REVIEW_REQUIRED when evidence is missing", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("[scenario:missing-evidence] 待验证声明。"),
      REQUESTER,
    );
    expect(detail.case.currentStage).toBe("REVIEW_REQUIRED");
    expect(detail.latestResult?.finalDecision?.decision).toBe("HUMAN_REVIEW");
  });

  it("walks the human pipeline and schedules via MockPublisher", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("[scenario:missing-evidence] 待验证声明。"),
      REQUESTER,
    );
    const id = detail.case.id;

    const afterOperator = await service.approve(
      id,
      { expectedVersion: 1, reason: "op ok" },
      OPERATOR,
      "it-op",
    );
    expect(afterOperator.case.currentStage).toBe("OPERATOR_REVIEW");

    const afterOperator2 = await service.approve(
      id,
      { expectedVersion: 1, reason: "op ok" },
      OPERATOR,
      "it-op2",
    );
    expect(afterOperator2.case.currentStage).toBe("COMPLIANCE_REVIEW");

    const afterCompliance = await service.approve(
      id,
      { expectedVersion: 1, reason: "cp ok" },
      COMPLIANCE,
      "it-cp",
    );
    expect(afterCompliance.case.currentStage).toBe("MEDIA_MANAGER_APPROVAL");

    const afterManager = await service.approve(
      id,
      { expectedVersion: 1, reason: "mm ok" },
      MANAGER,
      "it-mm",
    );
    expect(afterManager.case.currentStage).toBe("SCHEDULING");

    const scheduled = await service.schedule(
      id,
      { expectedVersion: 1, reason: "排期" },
      MANAGER,
      "it-schedule",
    );
    expect(scheduled.case.currentStage).toBe("COMPLETED");
    expect(scheduled.receipt.mode).toBe("mock");

    // Idempotent replay: same key must not schedule twice.
    const replayed = await service.schedule(
      id,
      { expectedVersion: 1, reason: "排期" },
      MANAGER,
      "it-schedule",
    );
    expect(replayed.receipt.receiptId).toBe(scheduled.receipt.receiptId);
  });

  it("revises atomically, increments the version and re-reviews", async () => {
    const { service, repository } = createService();
    const detail = await service.createReview(
      createInput("[scenario:operations-risk] 全网最低价，立即购买。"),
      REQUESTER,
    );
    expect(detail.case.currentStage).toBe("REVIEW_REQUIRED");

    const revised = await service.revise(
      detail.case.id,
      {
        expectedVersion: 1,
        reason: "修改绝对化表述",
        revisedContent: "今晚八点直播，点击了解详情。",
      },
      OPERATOR,
      "it-revise",
    );
    expect(revised.case.version).toBe(2);
    expect(revised.case.currentContent).toBe("今晚八点直播，点击了解详情。");
    expect(revised.action.action).toBe("REVISE");
    expect(revised.action.fromVersion).toBe(1);
    expect(revised.action.toVersion).toBe(2);

    const versions = await repository.listVersions(detail.case.id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    const results = await repository.listResults(detail.case.id);
    expect(results).toHaveLength(2);
    expect(results[1].version).toBe(2);
  });

  it("rejects and escalates to terminal stages", async () => {
    const { service } = createService();
    const rejected = await service.createReview(
      createInput("[scenario:missing-evidence] 一。"),
      REQUESTER,
    );
    const rejectedResult = await service.reject(
      rejected.case.id,
      { expectedVersion: 1, reason: "无法证实" },
      OPERATOR,
      null,
    );
    expect(rejectedResult.case.currentStage).toBe("REJECTED");

    const escalated = await service.createReview(
      createInput("[scenario:missing-evidence] 二。"),
      REQUESTER,
    );
    const escalatedResult = await service.escalate(
      escalated.case.id,
      { expectedVersion: 1, reason: "需要法务", escalationTarget: "LEGAL" },
      COMPLIANCE,
      null,
    );
    expect(escalatedResult.case.currentStage).toBe("ESCALATED");
  });

  it("returns 409 VERSION_CONFLICT for stale expectedVersion", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("[scenario:missing-evidence] 待验证。"),
      REQUESTER,
    );
    await expect(
      service.approve(
        detail.case.id,
        { expectedVersion: 99, reason: "stale" },
        OPERATOR,
        null,
      ),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
    });
  });

  it("fails closed when the engine throws", async () => {
    const brokenEngine: ReviewEngine = {
      async review(): Promise<ReviewEngineOutput> {
        throw new Error("engine exploded");
      },
      async resume(): Promise<ReviewEngineOutput> {
        throw new Error("engine exploded");
      },
    };
    const { service } = createService(brokenEngine);
    const detail = await service.createReview(
      createInput("任意内容。"),
      REQUESTER,
    );
    expect(detail.case.currentStage).toBe("REVIEW_REQUIRED");
    expect(detail.latestResult).toBeNull();

    const history = await service.getHistory(detail.case.id);
    expect(
      history.actions.some(
        (record) =>
          record.action.action === "AUTO_ROUTE" &&
          record.action.reason.includes("failed closed"),
      ),
    ).toBe(true);
  });

  it("aggregates history with versions, actions, results and snapshots", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("[scenario:operations-risk] 最低价。"),
      REQUESTER,
    );
    const history = await service.getHistory(detail.case.id);
    expect(history.case.id).toBe(detail.case.id);
    expect(history.versions).toHaveLength(1);
    expect(history.actions.map((a) => a.action.action)).toEqual([
      "SUBMIT",
      "AUTO_ROUTE",
    ]);
    expect(history.results).toHaveLength(1);
    expect(history.evidenceSnapshots).toHaveLength(1);
  });

  it("rejects actions with ApiRequestError instances", async () => {
    const { service } = createService();
    const detail = await service.createReview(
      createInput("[scenario:missing-evidence] 待验证。"),
      REQUESTER,
    );
    await expect(
      service.approve(
        detail.case.id,
        { expectedVersion: 1, reason: "no role" },
        REQUESTER,
        null,
      ),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });
});
