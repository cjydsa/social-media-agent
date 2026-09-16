import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  ReviewStageSchema,
  type ReviewActor,
} from "../algorithm/index.js";
import { toApiErrorEnvelope } from "../backend/api/request.js";
import { ApiRequestError } from "../backend/api/errors.js";
import {
  ACTOR_ID_HEADER,
  ACTOR_NAME_HEADER,
  ACTOR_ROLE_HEADER,
  parseActorFromHeaders,
} from "../backend/auth/dev-header.js";
import {
  CreateReviewRequestSchema,
  EscalateReviewRequestSchema,
  ReviewActionRequestSchema,
  ReviseReviewRequestSchema,
  ScheduleReviewRequestSchema,
  UploadFilesRequestSchema,
} from "../backend/dto/schemas.js";
import type { ReviewOrchestrationService } from "../backend/services/orchestration.js";
import { MAX_UPLOAD_BODY_BYTES, type LocalUploadStorage } from "./uploads.js";

export interface ReviewAppOptions {
  orchestration: ReviewOrchestrationService;
  uploadStorage: LocalUploadStorage;
  /** Built frontend directory; when absent, only the API is served. */
  consoleDistDir?: string | null;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function idempotencyKey(req: Request): string | null {
  return headerValue(req.headers["idempotency-key"]);
}

/**
 * Schema-validate a request body and map failures to 400 VALIDATION_ERROR
 * instead of leaking a 500. The legacy `actor` field in BE-001 DTOs is a
 * fixture-compatible shape: the server always overwrites it with the
 * authenticated header actor (contracts 12.7.1).
 */
function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
  actor?: ReviewActor,
): T {
  const candidate =
    actor && typeof body === "object" && body !== null
      ? { ...(body as Record<string, unknown>), actor }
      : body;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "Request body failed schema validation.",
      400,
      { issues: parsed.error.issues.map((issue) => issue.message) },
    );
  }
  return parsed.data;
}

export function createReviewApp(options: ReviewAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: MAX_UPLOAD_BODY_BYTES }));

  // Request id + actor identity (dev-header auth provider).
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.locals.requestId = `req_${randomBytes(8).toString("hex")}`;
    try {
      res.locals.actor = parseActorFromHeaders({
        id: headerValue(req.headers[ACTOR_ID_HEADER]),
        displayName: headerValue(req.headers[ACTOR_NAME_HEADER]),
        role: headerValue(req.headers[ACTOR_ROLE_HEADER]),
      });
    } catch (error) {
      next(error);
      return;
    }
    next();
  });

  const wrap =
    (
      handler: (req: Request, res: Response) => Promise<void>,
    ): ((req: Request, res: Response, next: NextFunction) => void) =>
    (req, res, next) => {
      handler(req, res).catch(next);
    };

  app.post(
    "/api/uploads",
    wrap(async (req, res) => {
      const body = parseBody(UploadFilesRequestSchema, req.body);
      const files = await options.uploadStorage.save(body.files);
      res.status(201).json({ data: { files } });
    }),
  );

  app.post(
    "/api/reviews",
    wrap(async (req, res) => {
      const body = parseBody(CreateReviewRequestSchema, req.body);
      const detail = await options.orchestration.createReview(
        body,
        res.locals.actor,
      );
      res.status(201).json({ data: detail });
    }),
  );

  app.get(
    "/api/reviews",
    wrap(async (req, res) => {
      const stageRaw = headerValue(
        req.query.stage as string | string[] | undefined,
      );
      const riskRaw = headerValue(
        req.query.riskLevel as string | string[] | undefined,
      );
      const limitRaw = headerValue(
        req.query.limit as string | string[] | undefined,
      );
      const cursor = headerValue(
        req.query.cursor as string | string[] | undefined,
      );

      let stage = null;
      if (stageRaw) {
        const parsed = ReviewStageSchema.safeParse(stageRaw);
        if (!parsed.success) {
          throw new ApiRequestError(
            "VALIDATION_ERROR",
            "Unknown stage filter.",
            400,
            { stage: stageRaw },
          );
        }
        stage = parsed.data;
      }
      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | null = null;
      if (riskRaw) {
        if (!["LOW", "MEDIUM", "HIGH"].includes(riskRaw)) {
          throw new ApiRequestError(
            "VALIDATION_ERROR",
            "Unknown riskLevel filter.",
            400,
            { riskLevel: riskRaw },
          );
        }
        riskLevel = riskRaw as "LOW" | "MEDIUM" | "HIGH";
      }
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          "limit must be an integer between 1 and 100.",
          400,
        );
      }

      const result = await options.orchestration.listReviews({
        stage,
        riskLevel,
        limit,
        cursor: cursor ?? null,
      });
      res.json(result);
    }),
  );

  app.get(
    "/api/reviews/:id",
    wrap(async (req, res) => {
      const detail = await options.orchestration.getReview(
        req.params.id,
        res.locals.actor,
      );
      res.json({ data: detail });
    }),
  );

  const actionHandler =
    (
      action: "approve" | "revise" | "reject" | "escalate" | "schedule",
    ): ((req: Request, res: Response) => Promise<void>) =>
    async (req, res) => {
      const actor = res.locals.actor;
      const key = idempotencyKey(req);
      const caseId = req.params.id;

      if (action === "approve") {
        const body = parseBody(ReviewActionRequestSchema, req.body, actor);
        const result = await options.orchestration.approve(
          caseId,
          body,
          actor,
          key,
        );
        res.json({ data: result });
        return;
      }
      if (action === "reject") {
        const body = parseBody(ReviewActionRequestSchema, req.body, actor);
        const result = await options.orchestration.reject(
          caseId,
          body,
          actor,
          key,
        );
        res.json({ data: result });
        return;
      }
      if (action === "escalate") {
        const body = parseBody(EscalateReviewRequestSchema, req.body, actor);
        const result = await options.orchestration.escalate(
          caseId,
          body,
          actor,
          key,
        );
        res.json({ data: result });
        return;
      }
      if (action === "revise") {
        const body = parseBody(ReviseReviewRequestSchema, req.body, actor);
        const result = await options.orchestration.revise(
          caseId,
          body,
          actor,
          key,
        );
        res.json({ data: result });
        return;
      }
      const body = parseBody(ScheduleReviewRequestSchema, req.body);
      const result = await options.orchestration.schedule(
        caseId,
        body,
        actor,
        key,
      );
      res.json({ data: result });
    };

  app.post("/api/reviews/:id/approve", wrap(actionHandler("approve")));
  app.post("/api/reviews/:id/revise", wrap(actionHandler("revise")));
  app.post("/api/reviews/:id/reject", wrap(actionHandler("reject")));
  app.post("/api/reviews/:id/escalate", wrap(actionHandler("escalate")));
  app.post("/api/reviews/:id/schedule", wrap(actionHandler("schedule")));

  app.get(
    "/api/reviews/:id/history",
    wrap(async (req, res) => {
      const history = await options.orchestration.getHistory(req.params.id);
      res.json({ data: history });
    }),
  );

  app.get(
    "/api/evaluations/latest",
    wrap(async (_req, res) => {
      const latest = await options.orchestration.getLatestEvaluation();
      res.json({ data: latest });
    }),
  );

  app.use(
    "/uploads",
    express.static(options.uploadStorage.directory, {
      index: false,
      fallthrough: false,
    }),
  );

  // Static console hosting (single-port delivery) with SPA fallback.
  const distDir = options.consoleDistDir ?? null;
  if (distDir && existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  // Unified error envelope.
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const requestId = (res.locals.requestId as string | undefined) ?? null;
      const { status, body } = toApiErrorEnvelope(error, requestId);
      res.status(status).json(body);
    },
  );

  return app;
}
