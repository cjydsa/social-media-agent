import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLangGraphReviewEngine } from "../../../src/pr-review/algorithm/engine/langgraph-review-engine.js";
import { InMemoryReviewRepository } from "../../../src/pr-review/backend/repositories/in-memory.js";
import { MockPublisher } from "../../../src/pr-review/backend/publishers/mock-publisher.js";
import { ReviewOrchestrationService } from "../../../src/pr-review/backend/services/orchestration.js";
import { createReviewApp } from "../../../src/pr-review/server/app.js";
import { LocalUploadStorage } from "../../../src/pr-review/server/uploads.js";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const HEADERS = {
  "content-type": "application/json",
  "x-actor-id": "usr_test",
  "x-actor-name": "Test User",
  "x-actor-role": "ACCOUNT_OPERATOR",
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const repository = new InMemoryReviewRepository();
  const orchestration = new ReviewOrchestrationService({
    repositories: {
      cases: repository,
      versions: repository,
      results: repository,
      evidence: repository,
      actions: repository,
      revisions: repository,
    },
    engine: createLangGraphReviewEngine(),
    publisher: new MockPublisher(),
  });
  const uploadDir = mkdtempSync(path.join(tmpdir(), "pr-uploads-"));
  // LocalUploadStorage guards against escaping the repo; for tests we point
  // it at a temp dir inside the repository workspace instead.
  const storage = new LocalUploadStorage(
    path.resolve(process.cwd(), ".tmp-test-uploads", path.basename(uploadDir)),
  );
  const app = createReviewApp({ orchestration, uploadStorage: storage });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ephemeral test port.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("PR Review HTTP API (SPRINT-005)", () => {
  it("rejects requests without actor headers (401 envelope)", async () => {
    const response = await fetch(`${baseUrl}/api/reviews`);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(typeof body.error.requestId).toBe("string");
  });

  it("decodes percent-encoded non-ASCII actor display names", async () => {
    const response = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-actor-id": "usr_cn",
        "x-actor-name": encodeURIComponent("市场部小王"),
        "x-actor-role": "REQUESTER",
      },
      body: JSON.stringify({
        contentType: "SOCIAL_POST",
        targetPlatform: ["WEIBO"],
        content: "一条普通的运营动态。",
        imageUrls: [],
        sourceUrls: [],
      }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.case.submitter.displayName).toBe("市场部小王");
  });

  it("accepts uploads, sniffs magic bytes and serves the file", async () => {
    const upload = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        files: [
          {
            fileName: "poster.png",
            mediaType: "image/png",
            dataBase64: PNG_1PX,
          },
        ],
      }),
    });
    expect(upload.status).toBe(201);
    const uploaded = await upload.json();
    const url = uploaded.data.files[0].url as string;
    expect(url.startsWith("/uploads/")).toBe(true);

    const file = await fetch(`${baseUrl}${url}`);
    expect(file.status).toBe(200);
  });

  it("rejects mismatched media type with 415", async () => {
    const response = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        files: [
          {
            fileName: "fake.jpg",
            mediaType: "image/jpeg",
            dataBase64: PNG_1PX,
          },
        ],
      }),
    });
    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("maps schema validation failures to 400 VALIDATION_ERROR", async () => {
    const response = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ contentType: "NOPE" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("runs the create -> detail -> approve -> history lifecycle", async () => {
    const created = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        contentType: "SOCIAL_POST",
        targetPlatform: ["WEIBO"],
        content: "[scenario:missing-evidence] 待验证的发布会声明。",
        imageUrls: [],
        sourceUrls: [],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const caseId = createdBody.data.case.id as string;
    expect(createdBody.data.case.currentStage).toBe("REVIEW_REQUIRED");

    const detail = await fetch(`${baseUrl}/api/reviews/${caseId}`, {
      headers: HEADERS,
    });
    const detailBody = await detail.json();
    expect(detailBody.data.allowedActions).toEqual([
      "APPROVE",
      "REVISE",
      "REJECT",
      "ESCALATE",
    ]);

    const approved = await fetch(`${baseUrl}/api/reviews/${caseId}/approve`, {
      method: "POST",
      headers: { ...HEADERS, "idempotency-key": "api-test-approve-1" },
      body: JSON.stringify({ expectedVersion: 1, reason: "通过" }),
    });
    expect(approved.status).toBe(200);
    const approvedBody = await approved.json();
    expect(approvedBody.data.case.currentStage).toBe("OPERATOR_REVIEW");

    const history = await fetch(`${baseUrl}/api/reviews/${caseId}/history`, {
      headers: HEADERS,
    });
    const historyBody = await history.json();
    expect(historyBody.data.versions).toHaveLength(1);
    expect(historyBody.data.actions.length).toBeGreaterThanOrEqual(3);
  });

  it("returns the latest evaluation as null instead of fabricating metrics", async () => {
    const response = await fetch(`${baseUrl}/api/evaluations/latest`, {
      headers: HEADERS,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.latestRun).toBeNull();
  });
});
