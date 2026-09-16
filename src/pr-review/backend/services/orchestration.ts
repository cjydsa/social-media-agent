import type {
  ContentType,
  EvidenceItem,
  FinalReviewDecision,
  ReviewAction,
  ReviewActor,
  ReviewCase,
  ReviewContext,
  ReviewEngine,
  ReviewEngineInput,
  ReviewEngineOutput,
  ReviewStage,
} from "../../algorithm/index.js";
import { ApiRequestError } from "../api/errors.js";
import type {
  CreateReviewRequest,
  PublishReceipt,
  ReviewDetailResponse,
  ReviewHistoryResponse,
} from "../dto/schemas.js";
import { RepositoryError } from "../repositories/errors.js";
import type {
  ContentVersionRepository,
  EvidenceRepository,
  ReviewActionRepository,
  ReviewCaseRepository,
  ReviewResultRepository,
  RevisionTransactionRepository,
} from "../repositories/ports.js";
import type { Publisher } from "../publishers/index.js";
import {
  assertActionAllowed,
  assertStageAction,
  combinedAllowedActions,
} from "./authorization.js";

export interface ReviewRepositories {
  cases: ReviewCaseRepository;
  versions: ContentVersionRepository;
  results: ReviewResultRepository;
  evidence: EvidenceRepository;
  actions: ReviewActionRepository;
  revisions: RevisionTransactionRepository;
}

export interface OrchestrationOptions {
  repositories: ReviewRepositories;
  engine: ReviewEngine;
  publisher: Publisher;
  now?: () => string;
  idFactory?: (prefix: string) => string;
  policyVersion?: string;
}

export interface ListReviewsQuery {
  stage: ReviewStage | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  limit: number;
  cursor: string | null;
}

export interface ListReviewsResult {
  data: ReviewCase[];
  page: { nextCursor: string | null };
}

export interface ActionResult {
  case: ReviewCase;
  action: ReviewAction;
}

export interface ScheduleResult {
  case: ReviewCase;
  action: ReviewAction;
  receipt: PublishReceipt;
}

interface IdempotencyRecord {
  key: string;
  caseId: string;
  action: string;
  result: ActionResult | ScheduleResult;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function createIdFactory(): (prefix: string) => string {
  let sequence = 0;
  return (prefix: string) => {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(6, "0")}`;
  };
}

function toContext(requestId: string): ReviewContext {
  return {
    requestId,
    deadlineAt: null,
    traceMetadata: {},
    cancellation: null,
    dependencies: {
      socialContextProvider: null,
    },
  };
}

function collectEvidence(output: ReviewEngineOutput): EvidenceItem[] {
  const items = new Map<string, EvidenceItem>();
  for (const result of output.results) {
    for (const item of result.evidence) items.set(item.id, item);
  }
  if (output.aggregateResult) {
    for (const item of output.aggregateResult.evidence) {
      items.set(item.id, item);
    }
  }
  return [...items.values()];
}

/**
 * Maps a successful engine run to the business pipeline stage
 * (contracts 12.7.6). Failures always fail closed to REVIEW_REQUIRED.
 */
function stageAfterEngineRun(output: ReviewEngineOutput): ReviewStage {
  if (output.failures.length > 0) return "REVIEW_REQUIRED";
  const decision: FinalReviewDecision | undefined = output.finalDecision;
  if (!decision) return "REVIEW_REQUIRED";
  switch (decision.decision) {
    case "PASS":
      return "SCHEDULING";
    case "REVISE":
    case "HUMAN_REVIEW":
      return "REVIEW_REQUIRED";
    case "BLOCK":
      return "REJECTED";
    default:
      return "REVIEW_REQUIRED";
  }
}

function stageAfterApprove(reviewCase: ReviewCase): ReviewStage {
  switch (reviewCase.currentStage) {
    case "REVIEW_REQUIRED":
      return "OPERATOR_REVIEW";
    case "OPERATOR_REVIEW":
      return reviewCase.imageUrls.length > 0
        ? "VISUAL_REVIEW"
        : "COMPLIANCE_REVIEW";
    case "VISUAL_REVIEW":
      return "COMPLIANCE_REVIEW";
    case "COMPLIANCE_REVIEW":
      return "MEDIA_MANAGER_APPROVAL";
    case "MEDIA_MANAGER_APPROVAL":
      return "SCHEDULING";
    default:
      return reviewCase.currentStage;
  }
}

export class ReviewOrchestrationService {
  readonly #repositories: ReviewRepositories;
  readonly #engine: ReviewEngine;
  readonly #publisher: Publisher;
  readonly #now: () => string;
  readonly #idFactory: (prefix: string) => string;
  readonly #policyVersion: string;
  readonly #idempotency = new Map<string, IdempotencyRecord>();

  constructor(options: OrchestrationOptions) {
    this.#repositories = options.repositories;
    this.#engine = options.engine;
    this.#publisher = options.publisher;
    this.#now = options.now ?? defaultNow;
    this.#idFactory = options.idFactory ?? createIdFactory();
    this.#policyVersion = options.policyVersion ?? "review-policy-v1";
  }

  async createReview(
    input: CreateReviewRequest,
    actor: ReviewActor,
  ): Promise<ReviewDetailResponse> {
    const caseId = this.#idFactory("case");
    const timestamp = this.#now();
    const reviewCase: ReviewCase = {
      id: caseId,
      contentType: input.contentType,
      targetPlatform: input.targetPlatform,
      originalContent: input.content,
      currentContent: input.content,
      imageUrls: input.imageUrls,
      submitter: { id: actor.id, displayName: actor.displayName },
      version: 1,
      currentStage: "REQUESTER_SELF_CHECK",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.#repositories.cases.createCase({
      case: reviewCase,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.#repositories.versions.appendVersion({
      versionId: this.#idFactory("version"),
      caseId,
      version: 1,
      content: input.content,
      imageUrls: input.imageUrls,
      targetPlatform: input.targetPlatform,
      createdBy: actor,
      createdAt: timestamp,
    });
    await this.#appendAction(caseId, {
      actor,
      action: "SUBMIT",
      reason: "Case submitted for review.",
      fromVersion: null,
      toVersion: 1,
    });

    const routed = await this.#runEngineAndRoute(reviewCase);
    return this.getReview(routed.id, actor);
  }

  async getReview(
    caseId: string,
    actor: ReviewActor,
  ): Promise<ReviewDetailResponse> {
    const record = await this.#requireCase(caseId);
    const latest = await this.#repositories.results.getLatestResult(caseId);
    return {
      case: record.case,
      latestResult: latest?.output ?? null,
      allowedActions: combinedAllowedActions(record.case, actor),
    };
  }

  async listReviews(query: ListReviewsQuery): Promise<ListReviewsResult> {
    const page = await this.#repositories.cases.listCases({
      limit: query.limit,
      cursor: query.cursor,
    });
    let cases = page.data.map((record) => record.case);
    if (query.stage) {
      cases = cases.filter((item) => item.currentStage === query.stage);
    }
    if (query.riskLevel) {
      const filtered: ReviewCase[] = [];
      for (const item of cases) {
        const latest = await this.#repositories.results.getLatestResult(
          item.id,
        );
        const risk = latest?.output.aggregateResult?.riskLevel ?? null;
        if (risk === query.riskLevel) filtered.push(item);
      }
      cases = filtered;
    }
    return { data: cases, page: { nextCursor: page.nextCursor } };
  }

  async approve(
    caseId: string,
    body: { expectedVersion: number; reason: string },
    actor: ReviewActor,
    idempotencyKey: string | null,
  ): Promise<ActionResult> {
    return this.#performHumanAction(
      caseId,
      "APPROVE",
      body,
      actor,
      idempotencyKey,
    );
  }

  async reject(
    caseId: string,
    body: { expectedVersion: number; reason: string },
    actor: ReviewActor,
    idempotencyKey: string | null,
  ): Promise<ActionResult> {
    return this.#performHumanAction(
      caseId,
      "REJECT",
      body,
      actor,
      idempotencyKey,
    );
  }

  async escalate(
    caseId: string,
    body: {
      expectedVersion: number;
      reason: string;
      escalationTarget: string | null;
    },
    actor: ReviewActor,
    idempotencyKey: string | null,
  ): Promise<ActionResult> {
    return this.#performHumanAction(
      caseId,
      "ESCALATE",
      body,
      actor,
      idempotencyKey,
      body.escalationTarget,
    );
  }

  async revise(
    caseId: string,
    body: { expectedVersion: number; reason: string; revisedContent: string },
    actor: ReviewActor,
    idempotencyKey: string | null,
  ): Promise<ActionResult> {
    const replayed = this.#replayIdempotency(idempotencyKey, caseId, "REVISE");
    if (replayed) return replayed as ActionResult;

    const record = await this.#requireCase(caseId);
    assertStageAction(record.case, "REVISE");
    assertActionAllowed(record.case, actor, "REVISE");
    this.#assertVersion(record.case, body.expectedVersion);

    let transaction;
    try {
      transaction = await this.#repositories.revisions.revise({
        caseId,
        expectedVersion: body.expectedVersion,
        revisedContent: body.revisedContent,
        actor,
        reason: body.reason,
        timestamp: this.#now(),
      });
    } catch (error) {
      throw this.#mapRepositoryError(error);
    }

    const routed = await this.#runEngineAndRoute(transaction.case);
    const result: ActionResult = {
      case: routed,
      action: transaction.action.action,
    };
    this.#rememberIdempotency(idempotencyKey, caseId, "REVISE", result);
    return result;
  }

  async schedule(
    caseId: string,
    body: { expectedVersion: number; reason: string },
    actor: ReviewActor,
    idempotencyKey: string | null,
  ): Promise<ScheduleResult> {
    const replayed = this.#replayIdempotency(
      idempotencyKey,
      caseId,
      "SCHEDULE",
    );
    if (replayed) return replayed as ScheduleResult;

    const record = await this.#requireCase(caseId);
    assertStageAction(record.case, "SCHEDULE");
    assertActionAllowed(record.case, actor, "SCHEDULE");
    this.#assertVersion(record.case, body.expectedVersion);

    const key = idempotencyKey ?? this.#idFactory("schedule");
    const receipt = await this.#publisher.schedule({
      caseId,
      version: record.case.version,
      idempotencyKey: key,
      requestedBy: actor,
      scheduledAt: this.#now(),
    });

    const updated = await this.#transitionStage(record.case, "COMPLETED");
    const action = await this.#appendAction(caseId, {
      actor,
      action: "SCHEDULE",
      reason: body.reason,
      fromVersion: record.case.version,
      toVersion: record.case.version,
    });

    const result: ScheduleResult = { case: updated, action, receipt };
    this.#rememberIdempotency(idempotencyKey, caseId, "SCHEDULE", result);
    return result;
  }

  async getHistory(caseId: string): Promise<ReviewHistoryResponse> {
    const record = await this.#requireCase(caseId);
    const [versions, actions, results, evidenceSnapshots] = await Promise.all([
      this.#repositories.versions.listVersions(caseId),
      this.#repositories.actions.listActions(caseId),
      this.#repositories.results.listResults(caseId),
      this.#repositories.evidence.listSnapshots(caseId),
    ]);
    return {
      case: record.case,
      versions,
      actions,
      results,
      evidenceSnapshots,
    };
  }

  async getLatestEvaluation(): Promise<{ latestRun: unknown | null }> {
    // No benchmark run has been executed yet; per contract we return null
    // instead of fabricating metrics.
    return { latestRun: null };
  }

  async #performHumanAction(
    caseId: string,
    action: "APPROVE" | "REJECT" | "ESCALATE",
    body: { expectedVersion: number; reason: string },
    actor: ReviewActor,
    idempotencyKey: string | null,
    escalationTarget: string | null = null,
  ): Promise<ActionResult> {
    const replayed = this.#replayIdempotency(idempotencyKey, caseId, action);
    if (replayed) return replayed as ActionResult;

    const record = await this.#requireCase(caseId);
    assertStageAction(record.case, action);
    assertActionAllowed(record.case, actor, action);
    this.#assertVersion(record.case, body.expectedVersion);

    const nextStage: ReviewStage =
      action === "APPROVE"
        ? stageAfterApprove(record.case)
        : action === "REJECT"
          ? "REJECTED"
          : "ESCALATED";

    const updated = await this.#transitionStage(record.case, nextStage);
    const reason =
      action === "ESCALATE" && escalationTarget
        ? `${body.reason} (target: ${escalationTarget})`
        : body.reason;
    const appended = await this.#appendAction(caseId, {
      actor,
      action,
      reason,
      fromVersion: record.case.version,
      toVersion: record.case.version,
    });

    if (action === "APPROVE" && nextStage === "MEDIA_MANAGER_APPROVAL") {
      await this.#appendAction(caseId, {
        actor: {
          id: "system",
          displayName: "Risk Routing",
          role: "SYSTEM",
        },
        action: "AUTO_ROUTE",
        reason: "Compliance approved; routed to media manager approval.",
        fromVersion: record.case.version,
        toVersion: record.case.version,
      });
    }

    const result: ActionResult = { case: updated, action: appended };
    this.#rememberIdempotency(idempotencyKey, caseId, action, result);
    return result;
  }

  async #runEngineAndRoute(reviewCase: ReviewCase): Promise<ReviewCase> {
    const input: ReviewEngineInput = {
      caseId: reviewCase.id,
      version: reviewCase.version,
      contentType: reviewCase.contentType as ContentType,
      targetPlatform: reviewCase.targetPlatform,
      currentContent: reviewCase.currentContent,
      imageUrls: reviewCase.imageUrls,
      currentStage: reviewCase.currentStage,
      policyVersion: this.#policyVersion,
      originalContent: reviewCase.originalContent,
    };

    let output: ReviewEngineOutput;
    try {
      output = await this.#engine.review(
        input,
        toContext(this.#idFactory("req")),
      );
    } catch (error) {
      // Fail closed: persist nothing as approved; route to REVIEW_REQUIRED.
      const updated = await this.#transitionStage(
        reviewCase,
        "REVIEW_REQUIRED",
      );
      await this.#appendAction(reviewCase.id, {
        actor: { id: "system", displayName: "Review Engine", role: "SYSTEM" },
        action: "AUTO_ROUTE",
        reason: `Review engine failed closed: ${error instanceof Error ? error.message : "unknown error"}`,
        fromVersion: reviewCase.version,
        toVersion: reviewCase.version,
      });
      return updated;
    }

    await this.#repositories.results.appendResult({
      resultId: this.#idFactory("result"),
      caseId: reviewCase.id,
      version: reviewCase.version,
      executionId: output.execution.executionId,
      output,
      createdAt: this.#now(),
    });

    const evidenceItems = collectEvidence(output);
    await this.#repositories.evidence.appendSnapshot({
      snapshotId: this.#idFactory("snapshot"),
      caseId: reviewCase.id,
      version: reviewCase.version,
      executionId: output.execution.executionId,
      knowledgeVersion: null,
      socialContextVersion: null,
      evidenceItems,
      createdAt: this.#now(),
    });

    const nextStage = stageAfterEngineRun(output);
    const updated = await this.#transitionStage(reviewCase, nextStage);
    await this.#appendAction(reviewCase.id, {
      actor: { id: "system", displayName: "Risk Routing", role: "SYSTEM" },
      action: "AUTO_ROUTE",
      reason: `Engine routed case to ${nextStage}.`,
      fromVersion: reviewCase.version,
      toVersion: reviewCase.version,
    });
    return updated;
  }

  async #transitionStage(
    reviewCase: ReviewCase,
    stage: ReviewStage,
  ): Promise<ReviewCase> {
    if (reviewCase.currentStage === stage) return reviewCase;
    const updated: ReviewCase = {
      ...reviewCase,
      currentStage: stage,
      updatedAt: this.#now(),
    };
    await this.#repositories.cases.updateCase({
      case: updated,
      createdAt: reviewCase.createdAt,
      updatedAt: updated.updatedAt,
    });
    return updated;
  }

  async #appendAction(
    caseId: string,
    action: Omit<ReviewAction, "timestamp">,
  ): Promise<ReviewAction> {
    const record = await this.#repositories.actions.appendAction({
      actionId: this.#idFactory("action"),
      caseId,
      action: { ...action, timestamp: this.#now() },
      createdAt: this.#now(),
    });
    return record.action;
  }

  async #requireCase(caseId: string) {
    const record = await this.#repositories.cases.getCase(caseId);
    if (!record) {
      throw new ApiRequestError("NOT_FOUND", "Review case not found.", 404, {
        caseId,
      });
    }
    return record;
  }

  #assertVersion(reviewCase: ReviewCase, expectedVersion: number): void {
    if (reviewCase.version !== expectedVersion) {
      throw new ApiRequestError(
        "VERSION_CONFLICT",
        "Case version changed.",
        409,
        { currentVersion: reviewCase.version, expectedVersion },
      );
    }
  }

  #mapRepositoryError(error: unknown): unknown {
    if (error instanceof RepositoryError) {
      if (error.code === "VERSION_CONFLICT") {
        return new ApiRequestError(
          "VERSION_CONFLICT",
          "Case version changed.",
          409,
          error.details ?? null,
        );
      }
      if (error.code === "NOT_FOUND") {
        return new ApiRequestError("NOT_FOUND", "Review case not found.", 404);
      }
    }
    return error;
  }

  #replayIdempotency(
    key: string | null,
    caseId: string,
    action: string,
  ): ActionResult | ScheduleResult | null {
    if (!key) return null;
    const record = this.#idempotency.get(key);
    if (!record || record.caseId !== caseId || record.action !== action) {
      return null;
    }
    return record.result;
  }

  #rememberIdempotency(
    key: string | null,
    caseId: string,
    action: string,
    result: ActionResult | ScheduleResult,
  ): void {
    if (!key) return;
    this.#idempotency.set(key, { key, caseId, action, result });
  }
}
