import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  ApiErrorEnvelopeSchema,
  PaginationQuerySchema,
  REVIEW_API_ROUTES,
  createApiErrorEnvelope,
  parseCreateReviewRequest,
  parseJsonRequest,
  reviewApiSchemas,
  toApiErrorEnvelope,
} from "../../../src/pr-review/backend/index.js";

describe("BE-001 API contracts", () => {
  it("freezes the nine MVP API routes", () => {
    expect(REVIEW_API_ROUTES).toEqual([
      "POST /api/reviews",
      "GET /api/reviews/:id",
      "GET /api/reviews",
      "POST /api/reviews/:id/approve",
      "POST /api/reviews/:id/revise",
      "POST /api/reviews/:id/reject",
      "POST /api/reviews/:id/escalate",
      "GET /api/reviews/:id/history",
      "GET /api/evaluations/latest",
    ]);
  });

  it("parses create review JSON and rejects unknown fields", () => {
    const body = JSON.stringify({
      contentType: "SOCIAL_POST",
      targetPlatform: ["WEIBO"],
      content: "合规的创建请求",
      imageUrls: [],
      sourceUrls: [],
    });
    expect(
      parseCreateReviewRequest({
        contentType: "application/json; charset=utf-8",
        body,
      }),
    ).toMatchObject({ content: "合规的创建请求" });

    expect(() =>
      parseCreateReviewRequest({
        contentType: "application/json",
        body: JSON.stringify({
          contentType: "SOCIAL_POST",
          targetPlatform: ["WEIBO"],
          content: "不能包含 submitter",
          imageUrls: [],
          sourceUrls: [],
          submitter: { id: "forged", displayName: "Forged" },
        }),
      }),
    ).toThrow("schema validation");
  });

  it("rejects wrong content type, invalid JSON, and oversized body", () => {
    expect(() =>
      parseCreateReviewRequest({
        contentType: "text/plain",
        body: "{}",
      }),
    ).toThrow("Content-Type");

    expect(() =>
      parseCreateReviewRequest({
        contentType: "application/json",
        body: "{",
      }),
    ).toThrow("not JSON");

    expect(() =>
      parseJsonRequest(reviewApiSchemas.create, {
        contentType: "application/json",
        body: JSON.stringify({ content: "x".repeat(100) }),
        maxBytes: 8,
      }),
    ).toThrow("size limit");
  });

  it("validates action DTOs and pagination", () => {
    const action = {
      expectedVersion: 1,
      actor: { id: "actor_1", displayName: "Operator", role: "operator" },
      reason: "人工确认",
    };
    expect(reviewApiSchemas.approve.safeParse(action).success).toBe(true);
    expect(
      reviewApiSchemas.approve.safeParse({ ...action, expectedVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      reviewApiSchemas.revise.safeParse({ ...action, revisedContent: "新版" })
        .success,
    ).toBe(true);
    expect(
      PaginationQuerySchema.safeParse({ limit: 101, cursor: null }).success,
    ).toBe(false);
  });

  it("uses typed error envelopes without stack traces", () => {
    const envelope = createApiErrorEnvelope({
      code: "VERSION_CONFLICT",
      message: "Case version changed.",
      details: { currentVersion: 2 },
      requestId: "req_1",
    });
    expect(ApiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
    expect(JSON.stringify(envelope)).not.toContain("stack");

    const mapped = toApiErrorEnvelope(new Error("secret detail"), "req_2");
    expect(mapped.status).toBe(500);
    expect(mapped.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(mapped.body)).not.toContain("secret detail");
  });

  it("keeps API handlers independent from graph, prompts, and reviewers", () => {
    const source = readFileSync(
      "src/pr-review/backend/api/handlers.ts",
      "utf8",
    );
    expect(source).not.toMatch(/graph|prompt|reviewer/i);
  });
});
