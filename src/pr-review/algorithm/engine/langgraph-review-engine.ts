import { Command, MemorySaver } from "@langchain/langgraph";
import type { ReviewEngine } from "../ports/review-engine.js";
import {
  ResumeReviewInputSchema,
  ReviewContextSchema,
  ReviewEngineInputSchema,
  ReviewEngineOutputSchema,
  type ExecutionReference,
  type InterruptDescriptor,
  type ReviewContext,
  type ReviewEngineInput,
  type ReviewEngineOutput,
  type ReviewFailure,
} from "../schemas/review-engine.js";
import type { ReviewResult } from "../schemas/review-result.js";
import type {
  DimensionReviewResult,
  FinalReviewDecision,
  ReviewPolicy,
} from "../schemas/multi-agent.js";
import {
  defaultScenarioResolver,
  type ReviewScenarioResolver,
} from "../agents/types.js";
import {
  DeterministicEvidenceToolset,
  type EvidenceToolset,
} from "../evidence/evidence-tools.js";
import { buildReviewGraph } from "../graph/build-review-graph.js";
import { parseReviewPolicy } from "../policy/review-policy.js";
import type { ReviewState } from "../state/review-state.js";
import type { ReviewAgentSet } from "../llm/runtime-agents.js";

interface ExecutionRecord {
  execution: ExecutionReference;
}

export interface LangGraphReviewEngineOptions {
  policy?: ReviewPolicy;
  scenarioResolver?: ReviewScenarioResolver;
  evidenceToolset?: EvidenceToolset;
  checkpointer?: MemorySaver;
  /** Optional LLM-backed agents (SPRINT-006 hybrid mode). */
  agents?: Partial<ReviewAgentSet>;
}

function riskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score < 40) return "LOW";
  if (score < 70) return "MEDIUM";
  return "HIGH";
}

function legacyResult(
  result: DimensionReviewResult,
  evidence: ReviewState["evidence"],
): ReviewResult {
  const referenced = new Set(result.evidenceIds);
  return {
    decision: {
      PASS: "APPROVE",
      WARN: "REVISE",
      BLOCK: "REJECT",
      REVIEW_REQUIRED: "REVIEW_REQUIRED",
    }[result.verdict] as ReviewResult["decision"],
    riskLevel: riskLevel(result.riskScore),
    confidence: result.confidence,
    issues: result.issues,
    evidence: evidence.filter(({ id }) => referenced.has(id)),
    suggestedRevision: result.suggestedChanges.join(" ") || null,
    reviewerType: "RULE",
    reviewerName: `deterministic-${result.dimension.toLowerCase()}`,
    latencyMs: 0,
    modelUsage: {
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: null,
      currency: null,
    },
  };
}

function aggregateResult(
  decision: FinalReviewDecision,
  evidence: ReviewState["evidence"],
): ReviewResult {
  return {
    decision: {
      PASS: "APPROVE",
      REVISE: "REVISE",
      HUMAN_REVIEW: "REVIEW_REQUIRED",
      BLOCK: "REJECT",
    }[decision.decision] as ReviewResult["decision"],
    riskLevel: riskLevel(decision.overallRiskScore),
    confidence: decision.confidence,
    issues: decision.dimensionResults.flatMap(({ issues }) => issues),
    evidence,
    suggestedRevision: decision.revisionDirection.join(" ") || null,
    reviewerType: "AGGREGATOR",
    reviewerName: "five-dimension-policy-guard-v1",
    latencyMs: 0,
    modelUsage: {
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: null,
      currency: null,
    },
  };
}

function humanInterrupt(decision: FinalReviewDecision): InterruptDescriptor {
  return {
    type: "HUMAN_REVIEW",
    stage: "REVIEW_REQUIRED",
    allowedActions: ["APPROVE", "REVISE", "REJECT", "ESCALATE"],
    reason: decision.summary,
    requiredRole: "MEDIA_MANAGER",
  };
}

function interrupted(
  state: ReviewState & { __interrupt__?: unknown[] },
): boolean {
  return Array.isArray(state.__interrupt__) && state.__interrupt__.length > 0;
}

function outputFromState(
  state: ReviewState & { __interrupt__?: unknown[] },
): ReviewEngineOutput {
  const finalDecision = state.finalDecision;
  if (!state.plan || !state.critic || !state.judge || !finalDecision) {
    throw new Error("Graph completed without required v1.1 output state.");
  }
  const isInterrupted = interrupted(state);
  const nextStage = state.terminalStage
    ? state.terminalStage
    : isInterrupted
      ? "REVIEW_REQUIRED"
      : finalDecision.decision === "BLOCK"
        ? "REJECTED"
        : "COMPLETED";

  return ReviewEngineOutputSchema.parse({
    caseId: state.input.caseId,
    version: state.input.version,
    results: state.dimensionResults.map((result) =>
      legacyResult(result, state.evidence),
    ),
    aggregateResult: aggregateResult(finalDecision, state.evidence),
    nextStage,
    requiresHuman: isInterrupted || finalDecision.decision === "HUMAN_REVIEW",
    interrupt: isInterrupted ? humanInterrupt(finalDecision) : null,
    execution: state.execution,
    failures: state.failures,
    reviewPlan: state.plan,
    evidenceCriticResult: state.critic,
    judgeRecommendation: state.judge,
    finalDecision,
  });
}

function failureOutput(
  input: Pick<ReviewEngineInput, "caseId" | "version">,
  execution: ExecutionReference,
  failure: ReviewFailure,
): ReviewEngineOutput {
  return ReviewEngineOutputSchema.parse({
    caseId: input.caseId,
    version: input.version,
    results: [],
    aggregateResult: null,
    nextStage: "REVIEW_REQUIRED",
    requiresHuman: true,
    interrupt: {
      type: "HUMAN_REVIEW",
      stage: "REVIEW_REQUIRED",
      allowedActions: ["REJECT", "ESCALATE"],
      reason: failure.message,
      requiredRole: "MEDIA_MANAGER",
    },
    execution,
    failures: [failure],
  });
}

function contextFailure(context: ReviewContext): ReviewFailure | null {
  if (context.cancellation?.aborted) {
    return {
      code: "CANCELLED",
      message: "Review execution was cancelled.",
      retryable: false,
      source: "REVIEW_ENGINE",
      details: null,
    };
  }
  if (context.deadlineAt && Date.parse(context.deadlineAt) <= Date.now()) {
    return {
      code: "TIMEOUT",
      message: "Review execution deadline has elapsed.",
      retryable: true,
      source: "REVIEW_ENGINE",
      details: null,
    };
  }
  return null;
}

export class LangGraphReviewEngine implements ReviewEngine {
  readonly #checkpointer: MemorySaver;
  readonly #evidenceToolset: EvidenceToolset;
  readonly #policy: ReviewPolicy;
  readonly #scenarioResolver: ReviewScenarioResolver;
  readonly #agents: Partial<ReviewAgentSet>;
  readonly #executions = new Map<string, ExecutionRecord>();
  #sequence = 0;

  constructor(options: LangGraphReviewEngineOptions = {}) {
    this.#checkpointer = options.checkpointer ?? new MemorySaver();
    this.#evidenceToolset =
      options.evidenceToolset ?? new DeterministicEvidenceToolset();
    this.#policy = parseReviewPolicy(options.policy);
    this.#scenarioResolver =
      options.scenarioResolver ?? defaultScenarioResolver;
    this.#agents = options.agents ?? {};
  }

  async review(
    rawInput: ReviewEngineInput,
    rawContext: ReviewContext,
  ): Promise<ReviewEngineOutput> {
    const inputResult = ReviewEngineInputSchema.safeParse(rawInput);
    const contextResult = ReviewContextSchema.safeParse(rawContext);
    const execution = this.#createExecution(
      inputResult.success ? inputResult.data.caseId : rawInput.caseId,
      inputResult.success ? inputResult.data.version : rawInput.version,
    );

    if (!inputResult.success || !contextResult.success) {
      return failureOutput(
        {
          caseId: rawInput.caseId || "invalid-case",
          version:
            Number.isInteger(rawInput.version) && rawInput.version >= 1
              ? rawInput.version
              : 1,
        },
        execution,
        {
          code: "INVALID_INPUT",
          message: "Review input or runtime context failed schema validation.",
          retryable: false,
          source: "INPUT",
          details: null,
        },
      );
    }

    const earlyFailure = contextFailure(contextResult.data);
    if (earlyFailure)
      return failureOutput(inputResult.data, execution, earlyFailure);

    const graph = buildReviewGraph({
      checkpointer: this.#checkpointer,
      evidenceToolset: this.#evidenceToolset,
      policy: this.#policy,
      scenarioResolver: this.#scenarioResolver,
      agents: this.#agents,
    });
    const state = (await graph.invoke(
      { input: inputResult.data, execution },
      { configurable: { thread_id: execution.threadId } },
    )) as ReviewState & { __interrupt__?: unknown[] };
    return outputFromState(state);
  }

  async resume(
    rawInput: Parameters<ReviewEngine["resume"]>[0],
    rawContext: ReviewContext,
  ): Promise<ReviewEngineOutput> {
    const inputResult = ResumeReviewInputSchema.safeParse(rawInput);
    const contextResult = ReviewContextSchema.safeParse(rawContext);
    const fallbackExecution: ExecutionReference = {
      executionId: rawInput.executionId || "invalid-execution",
      threadId: rawInput.executionId || "invalid-execution",
      runId: null,
    };
    const record = this.#executions.get(rawInput.executionId);

    if (!inputResult.success || !contextResult.success || !record) {
      return failureOutput(
        {
          caseId: rawInput.caseId || "invalid-case",
          version:
            Number.isInteger(rawInput.version) && rawInput.version >= 1
              ? rawInput.version
              : 1,
        },
        record?.execution ?? fallbackExecution,
        {
          code: "INVALID_INPUT",
          message: record
            ? "Resume input or runtime context failed schema validation."
            : "Unknown review execution.",
          retryable: false,
          source: "INPUT",
          details: null,
        },
      );
    }

    const earlyFailure = contextFailure(contextResult.data);
    if (earlyFailure) {
      return failureOutput(inputResult.data, record.execution, earlyFailure);
    }

    const graph = buildReviewGraph({
      checkpointer: this.#checkpointer,
      evidenceToolset: this.#evidenceToolset,
      policy: this.#policy,
      scenarioResolver: this.#scenarioResolver,
      agents: this.#agents,
    });
    const state = (await graph.invoke(
      new Command({ resume: inputResult.data }),
      {
        configurable: { thread_id: record.execution.threadId },
      },
    )) as ReviewState & { __interrupt__?: unknown[] };
    return outputFromState(state);
  }

  #createExecution(caseId: string, version: number): ExecutionReference {
    this.#sequence += 1;
    const execution: ExecutionReference = {
      executionId: `exec-${caseId}-v${version}-${this.#sequence}`,
      threadId: `thread-${caseId}-v${version}-${this.#sequence}`,
      runId: null,
    };
    this.#executions.set(execution.executionId, { execution });
    return execution;
  }
}

export function createLangGraphReviewEngine(
  options: LangGraphReviewEngineOptions = {},
): ReviewEngine {
  return new LangGraphReviewEngine(options);
}
