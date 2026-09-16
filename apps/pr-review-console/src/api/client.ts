import type {
  ApiErrorBody,
  ContentType,
  ReviewActionResponse,
  ReviewCase,
  ReviewDetailResponse,
  ReviewHistoryResponse,
  ReviewListResponse,
  ReviewStage,
  RiskLevel,
  ScheduleReviewResponse,
  UploadedFile,
} from "./types";

export interface Actor {
  id: string;
  displayName: string;
  role: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> | null,
    public readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  actor: Actor,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-actor-id": actor.id,
    // HTTP headers are ISO-8859-1 only; non-ASCII names travel percent-encoded
    // (contracts 12.7.1). The server decodes them.
    "x-actor-name": encodeURIComponent(actor.displayName),
    "x-actor-role": actor.role,
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetch(path, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.code ?? "INTERNAL_ERROR",
      errorBody?.error?.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      errorBody?.error?.details ?? null,
      errorBody?.error?.requestId ?? null,
    );
  }
  return body as T;
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export interface CreateReviewInput {
  contentType: ContentType;
  targetPlatform: string[];
  content: string;
  imageUrls: string[];
  sourceUrls: string[];
}

export const api = {
  listReviews(
    actor: Actor,
    query: {
      stage?: ReviewStage | "";
      riskLevel?: RiskLevel | "";
      limit?: number;
      cursor?: string | null;
    } = {},
  ): Promise<ReviewListResponse> {
    const params = new URLSearchParams();
    if (query.stage) params.set("stage", query.stage);
    if (query.riskLevel) params.set("riskLevel", query.riskLevel);
    params.set("limit", String(query.limit ?? 20));
    if (query.cursor) params.set("cursor", query.cursor);
    return request<ReviewListResponse>(actor, `/api/reviews?${params}`);
  },

  getReview(actor: Actor, caseId: string): Promise<ReviewDetailResponse> {
    return request<{ data: ReviewDetailResponse }>(
      actor,
      `/api/reviews/${caseId}`,
    ).then((r) => r.data);
  },

  createReview(
    actor: Actor,
    input: CreateReviewInput,
  ): Promise<ReviewDetailResponse> {
    return request<{ data: ReviewDetailResponse }>(actor, "/api/reviews", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  uploadFiles(
    actor: Actor,
    files: { fileName: string; mediaType: string; dataBase64: string }[],
  ): Promise<UploadedFile[]> {
    return request<{ data: { files: UploadedFile[] } }>(actor, "/api/uploads", {
      method: "POST",
      body: JSON.stringify({ files }),
    }).then((r) => r.data.files);
  },

  act(
    actor: Actor,
    caseId: string,
    action: "approve" | "reject",
    body: { expectedVersion: number; reason: string },
  ): Promise<ReviewActionResponse> {
    return request<{ data: ReviewActionResponse }>(
      actor,
      `/api/reviews/${caseId}/${action}`,
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey() },
        body: JSON.stringify(body),
      },
    ).then((r) => r.data);
  },

  revise(
    actor: Actor,
    caseId: string,
    body: { expectedVersion: number; reason: string; revisedContent: string },
  ): Promise<ReviewActionResponse> {
    return request<{ data: ReviewActionResponse }>(
      actor,
      `/api/reviews/${caseId}/revise`,
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey() },
        body: JSON.stringify(body),
      },
    ).then((r) => r.data);
  },

  escalate(
    actor: Actor,
    caseId: string,
    body: {
      expectedVersion: number;
      reason: string;
      escalationTarget: string | null;
    },
  ): Promise<ReviewActionResponse> {
    return request<{ data: ReviewActionResponse }>(
      actor,
      `/api/reviews/${caseId}/escalate`,
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey() },
        body: JSON.stringify(body),
      },
    ).then((r) => r.data);
  },

  schedule(
    actor: Actor,
    caseId: string,
    body: { expectedVersion: number; reason: string },
  ): Promise<ScheduleReviewResponse> {
    return request<{ data: ScheduleReviewResponse }>(
      actor,
      `/api/reviews/${caseId}/schedule`,
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey() },
        body: JSON.stringify(body),
      },
    ).then((r) => r.data);
  },

  getHistory(actor: Actor, caseId: string): Promise<ReviewHistoryResponse> {
    return request<{ data: ReviewHistoryResponse }>(
      actor,
      `/api/reviews/${caseId}/history`,
    ).then((r) => r.data);
  },

  getLatestEvaluation(actor: Actor): Promise<{ latestRun: unknown | null }> {
    return request<{ data: { latestRun: unknown | null } }>(
      actor,
      "/api/evaluations/latest",
    ).then((r) => r.data);
  },
};

export type { ReviewCase };
