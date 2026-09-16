import {
  CreateReviewRequestSchema,
  EscalateReviewRequestSchema,
  PaginationQuerySchema,
  ReviewActionRequestSchema,
  ReviseReviewRequestSchema,
} from "../dto/schemas.js";
import { parseJsonRequest } from "./request.js";

export const REVIEW_API_ROUTES = [
  "POST /api/reviews",
  "GET /api/reviews/:id",
  "GET /api/reviews",
  "POST /api/reviews/:id/approve",
  "POST /api/reviews/:id/revise",
  "POST /api/reviews/:id/reject",
  "POST /api/reviews/:id/escalate",
  "GET /api/reviews/:id/history",
  "GET /api/evaluations/latest",
] as const;

export type ReviewApiRoute = (typeof REVIEW_API_ROUTES)[number];

export const reviewApiSchemas = {
  create: CreateReviewRequestSchema,
  approve: ReviewActionRequestSchema,
  revise: ReviseReviewRequestSchema,
  reject: ReviewActionRequestSchema,
  escalate: EscalateReviewRequestSchema,
  list: PaginationQuerySchema,
} as const;

export function parseCreateReviewRequest(input: {
  contentType: string | null | undefined;
  body: string;
}) {
  return parseJsonRequest(CreateReviewRequestSchema, input);
}

export function parseReviewActionRequest(input: {
  contentType: string | null | undefined;
  body: string;
}) {
  return parseJsonRequest(ReviewActionRequestSchema, input);
}

export function parseReviseReviewRequest(input: {
  contentType: string | null | undefined;
  body: string;
}) {
  return parseJsonRequest(ReviseReviewRequestSchema, input);
}
