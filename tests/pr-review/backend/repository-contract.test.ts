import { describe, expect, it } from "@jest/globals";
import {
  InMemoryReviewRepository,
  RepositoryError,
  type ContentVersionRecord,
  type ReviewActionRecord,
  type ReviewCaseRecord,
} from "../../../src/pr-review/backend/index.js";
import { createReviewResultFixture } from "../contracts/fixtures.js";

const timestamp = "2026-09-01T02:00:00.000Z";

function createCaseRecord(): ReviewCaseRecord {
  return {
    case: {
      id: "case_repo_001",
      contentType: "SOCIAL_POST",
      targetPlatform: ["WEIBO"],
      originalContent: "初始内容",
      currentContent: "初始内容",
      imageUrls: [],
      submitter: { id: "submitter_1", displayName: "Submitter" },
      version: 1,
      currentStage: "REQUESTER_SELF_CHECK",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createInitialVersion(): ContentVersionRecord {
  return {
    versionId: "version_001",
    caseId: "case_repo_001",
    version: 1,
    content: "初始内容",
    imageUrls: [],
    targetPlatform: ["WEIBO"],
    createdBy: {
      id: "submitter_1",
      displayName: "Submitter",
      role: "requester",
    },
    createdAt: timestamp,
  };
}

function createSubmitAction(): ReviewActionRecord {
  return {
    actionId: "action_submit_001",
    caseId: "case_repo_001",
    action: {
      actor: { id: "submitter_1", displayName: "Submitter", role: "requester" },
      action: "SUBMIT",
      reason: "提交审核",
      fromVersion: 1,
      toVersion: 1,
      timestamp,
    },
    createdAt: timestamp,
  };
}

async function createSeededRepository(): Promise<InMemoryReviewRepository> {
  const repository = new InMemoryReviewRepository({ now: () => timestamp });
  await repository.createCase(createCaseRecord());
  await repository.appendVersion(createInitialVersion());
  await repository.appendAction(createSubmitAction());
  return repository;
}

describe("BE-002 repository contracts", () => {
  it("creates a case with immutable content versions", async () => {
    const repository = await createSeededRepository();
    const version = await repository.getVersion("case_repo_001", 1);
    expect(version?.content).toBe("初始内容");
    expect(() => {
      (version as { content: string }).content = "外部篡改";
    }).toThrow();
    const storedAgain = await repository.getVersion("case_repo_001", 1);
    expect(storedAgain?.content).toBe("初始内容");
  });

  it("keeps review actions append-only", async () => {
    const repository = await createSeededRepository();
    await repository.appendAction({
      actionId: "action_approve_001",
      caseId: "case_repo_001",
      action: {
        actor: { id: "operator_1", displayName: "Operator", role: "operator" },
        action: "APPROVE",
        reason: "人工确认",
        fromVersion: 1,
        toVersion: 1,
        timestamp,
      },
      createdAt: timestamp,
    });

    const actions = await repository.listActions("case_repo_001");
    expect(actions.map((action) => action.action.action)).toEqual([
      "SUBMIT",
      "APPROVE",
    ]);
  });

  it("rejects optimistic locking conflicts without partial writes", async () => {
    const repository = await createSeededRepository();
    await expect(
      repository.revise({
        caseId: "case_repo_001",
        expectedVersion: 2,
        revisedContent: "不会写入",
        actor: { id: "operator_1", displayName: "Operator", role: "operator" },
        reason: "版本冲突",
        timestamp,
      }),
    ).rejects.toBeInstanceOf(RepositoryError);

    expect(await repository.listVersions("case_repo_001")).toHaveLength(1);
    expect(await repository.listActions("case_repo_001")).toHaveLength(1);
  });

  it("commits revise transaction as version plus action", async () => {
    const repository = await createSeededRepository();
    const result = await repository.revise({
      caseId: "case_repo_001",
      expectedVersion: 1,
      revisedContent: "修订后内容",
      actor: { id: "operator_1", displayName: "Operator", role: "operator" },
      reason: "根据审核意见修订",
      timestamp,
    });

    expect(result.case.version).toBe(2);
    expect(result.version.content).toBe("修订后内容");
    expect(result.action.action.action).toBe("REVISE");
    expect(await repository.listVersions("case_repo_001")).toHaveLength(2);
    expect(await repository.listActions("case_repo_001")).toHaveLength(2);
  });

  it("stores results and evidence snapshots by case/version/execution", async () => {
    const repository = await createSeededRepository();
    const output = {
      caseId: "case_repo_001",
      version: 1,
      results: [createReviewResultFixture()],
      aggregateResult: createReviewResultFixture(),
      nextStage: "COMPLETED" as const,
      requiresHuman: false,
      interrupt: null,
      execution: {
        executionId: "exec_001",
        threadId: "thread_001",
        runId: null,
      },
      failures: [],
    };

    await repository.appendResult({
      resultId: "result_001",
      caseId: "case_repo_001",
      version: 1,
      executionId: "exec_001",
      output,
      createdAt: timestamp,
    });
    await repository.appendSnapshot({
      snapshotId: "snapshot_001",
      caseId: "case_repo_001",
      version: 1,
      executionId: "exec_001",
      knowledgeVersion: "knowledge-v1",
      socialContextVersion: null,
      evidenceItems: output.results[0]?.evidence ?? [],
      createdAt: timestamp,
    });

    const [storedResult] = await repository.listResults("case_repo_001");
    const [snapshot] = await repository.listSnapshots("case_repo_001");
    expect(storedResult?.executionId).toBe("exec_001");
    expect(snapshot).toMatchObject({
      caseId: "case_repo_001",
      version: 1,
      executionId: "exec_001",
      knowledgeVersion: "knowledge-v1",
    });
  });
});
