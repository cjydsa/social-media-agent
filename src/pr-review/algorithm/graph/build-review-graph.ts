import {
  END,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import type { EvidenceToolset } from "../evidence/evidence-tools.js";
import {
  type FinalReviewDecision,
  type ReviewDimension,
  type ReviewPolicy,
} from "../schemas/multi-agent.js";
import {
  ResumeReviewInputSchema,
  type ReviewFailure,
} from "../schemas/review-engine.js";
import {
  ReviewStateAnnotation,
  type ReviewState,
} from "../state/review-state.js";
import type { ReviewScenarioResolver } from "../agents/types.js";
import { createReviewPlan } from "../agents/review-planner.js";
import { createFailureResult, runSpecialist } from "../agents/specialists.js";
import { critiqueEvidence } from "../agents/evidence-critic.js";
import { judgeReview } from "../agents/decision-judge.js";
import { proposeRevision } from "../agents/revision-agent.js";
import { applyPolicyGuard } from "../policy/policy-guard.js";
import type { ReviewAgentSet } from "../llm/runtime-agents.js";

export interface BuildReviewGraphOptions {
  checkpointer: BaseCheckpointSaver;
  evidenceToolset: EvidenceToolset;
  policy: ReviewPolicy;
  scenarioResolver: ReviewScenarioResolver;
  /**
   * Optional LLM-backed agents (SPRINT-006). Missing ports fall back to the
   * deterministic implementations; an agent failure is recorded in
   * `failures` and fail-closed by the Policy Guard.
   */
  agents?: Partial<ReviewAgentSet>;
}

function requireValue<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Missing graph state: ${name}.`);
  return value;
}

function reviewFailure(
  dimension: ReviewDimension,
  error: unknown,
): ReviewFailure {
  return {
    code: "REVIEWER_FAILED",
    message:
      error instanceof Error ? error.message : "Specialist reviewer failed.",
    retryable: false,
    source: "REVIEW_ENGINE",
    details: { dimension },
  };
}

function tightenedHumanDecision(
  decision: FinalReviewDecision,
  summary: string,
): FinalReviewDecision {
  return {
    ...decision,
    decision: "HUMAN_REVIEW",
    publishable: false,
    summary,
  };
}

export function buildReviewGraph(options: BuildReviewGraphOptions) {
  const agents = options.agents ?? {};

  const specialistNode =
    (dimension: ReviewDimension) => async (state: ReviewState) => {
      try {
        if (agents.reviewDimension) {
          return {
            dimensionResults: [
              await agents.reviewDimension({
                dimension,
                input: state.input,
                plan: requireValue(state.plan, "plan"),
                evidence: state.evidence,
              }),
            ],
          };
        }
        return {
          dimensionResults: [
            runSpecialist(
              dimension,
              options.scenarioResolver(state.input),
              new Set(state.evidence.map(({ id }) => id)),
            ),
          ],
        };
      } catch (error) {
        return {
          dimensionResults: [createFailureResult(dimension)],
          failures: [reviewFailure(dimension, error)],
        };
      }
    };

  const graph = new StateGraph(ReviewStateAnnotation)
    .addNode("input_validation", (state: ReviewState) => ({
      input: state.input,
    }))
    .addNode("content_understanding", (state: ReviewState) => ({
      contentSummary: `内容类型 ${state.input.contentType}，目标平台 ${state.input.targetPlatform.join(", ") || "未提供"}。`,
      humanAction: undefined,
      terminalStage: undefined,
      pendingInterrupt: null,
    }))
    .addNode("review_planner", async (state: ReviewState) => {
      if (agents.plan) {
        try {
          return { plan: await agents.plan(state.input) };
        } catch (error) {
          // Deterministic fallback keeps the graph moving; the recorded
          // failure still forces fail-closed handling downstream.
          return {
            plan: createReviewPlan(
              state.input,
              options.scenarioResolver(state.input),
            ),
            failures: [
              {
                code: "REVIEWER_FAILED",
                message:
                  error instanceof Error
                    ? error.message
                    : "LLM planner failed; deterministic fallback used.",
                retryable: true,
                source: "MODEL" as const,
                details: { role: "planner" },
              },
            ],
          };
        }
      }
      return {
        plan: createReviewPlan(
          state.input,
          options.scenarioResolver(state.input),
        ),
      };
    })
    .addNode("evidence_planning", async (state: ReviewState) => {
      const result = await options.evidenceToolset.collect(
        requireValue(state.plan, "plan"),
        options.scenarioResolver(state.input),
        state.input,
      );
      return { evidence: result.evidence, evidenceCoverage: result.coverage };
    })
    .addNode("public_relations_review", specialistNode("PUBLIC_RELATIONS"))
    .addNode("operations_review", specialistNode("OPERATIONS"))
    .addNode("product_review", specialistNode("PRODUCT"))
    .addNode("customer_review", specialistNode("CUSTOMER"))
    .addNode("compliance_safety_review", specialistNode("COMPLIANCE_SAFETY"))
    .addNode("evidence_critic", async (state: ReviewState) => {
      if (agents.critique) {
        try {
          return {
            critic: await agents.critique({
              input: state.input,
              results: state.dimensionResults,
              coverage: requireValue(state.evidenceCoverage, "evidenceCoverage"),
            }),
          };
        } catch (error) {
          return {
            critic: critiqueEvidence(
              state.dimensionResults,
              requireValue(state.evidenceCoverage, "evidenceCoverage"),
              options.scenarioResolver(state.input),
            ),
            failures: [
              {
                code: "REVIEWER_FAILED",
                message:
                  error instanceof Error
                    ? error.message
                    : "LLM critic failed; deterministic fallback used.",
                retryable: true,
                source: "MODEL" as const,
                details: { role: "critic" },
              },
            ],
          };
        }
      }
      return {
        critic: critiqueEvidence(
          state.dimensionResults,
          requireValue(state.evidenceCoverage, "evidenceCoverage"),
          options.scenarioResolver(state.input),
        ),
      };
    })
    .addNode("decision_judge", async (state: ReviewState) => {
      if (agents.judge) {
        try {
          return {
            judge: await agents.judge({
              input: state.input,
              results: state.dimensionResults,
              critic: requireValue(state.critic, "critic"),
            }),
          };
        } catch (error) {
          return {
            judge: judgeReview(
              state.dimensionResults,
              requireValue(state.critic, "critic"),
              options.policy,
            ),
            failures: [
              {
                code: "REVIEWER_FAILED",
                message:
                  error instanceof Error
                    ? error.message
                    : "LLM judge failed; deterministic fallback used.",
                retryable: true,
                source: "MODEL" as const,
                details: { role: "judge" },
              },
            ],
          };
        }
      }
      return {
        judge: judgeReview(
          state.dimensionResults,
          requireValue(state.critic, "critic"),
          options.policy,
        ),
      };
    })
    .addNode("policy_guard", (state: ReviewState) => ({
      finalDecision: applyPolicyGuard({
        dimensionResults: state.dimensionResults,
        critic: requireValue(state.critic, "critic"),
        judge: requireValue(state.judge, "judge"),
        evidenceCoverage: requireValue(
          state.evidenceCoverage,
          "evidenceCoverage",
        ),
        failures: state.failures,
        policy: options.policy,
      }),
    }))
    .addNode("revision_agent", async (state: ReviewState) => {
      if (agents.revise) {
        try {
          return {
            revisionProposal: await agents.revise({
              input: state.input,
              results: state.dimensionResults,
              judge: requireValue(state.judge, "judge"),
            }),
          };
        } catch {
          return {
            revisionProposal: proposeRevision(state.dimensionResults),
          };
        }
      }
      return {
        revisionProposal: proposeRevision(state.dimensionResults),
      };
    })
    .addNode("await_human_review", (state: ReviewState) => {
      const descriptor = {
        type: "HUMAN_REVIEW" as const,
        stage: "REVIEW_REQUIRED" as const,
        allowedActions: ["APPROVE", "REVISE", "REJECT", "ESCALATE"] as const,
        reason: state.finalDecision?.summary ?? "多智能体审核要求人工复核。",
        requiredRole: "MEDIA_MANAGER",
      };
      const resume = ResumeReviewInputSchema.parse(interrupt(descriptor));
      const currentDecision = requireValue(
        state.finalDecision,
        "finalDecision",
      );

      if (resume.action === "REVISE") {
        const revisionCount = state.revisionCount + 1;
        if (revisionCount >= options.policy.maxRevisionCount) {
          return {
            humanAction: resume.action,
            revisionCount,
            pendingInterrupt: null,
            terminalStage: "ESCALATED" as const,
            finalDecision: tightenedHumanDecision(
              currentDecision,
              "已达到最大修订次数，必须人工升级。",
            ),
          };
        }
        return {
          input: {
            ...state.input,
            currentContent: resume.revisedContent,
            version: state.input.version + 1,
          },
          revisionCount,
          humanAction: resume.action,
          pendingInterrupt: null,
        };
      }

      if (resume.action === "REJECT") {
        return {
          humanAction: resume.action,
          pendingInterrupt: null,
          terminalStage: "REJECTED" as const,
          finalDecision: {
            ...currentDecision,
            decision: "BLOCK" as const,
            publishable: false,
            summary: "人工审核已拒绝当前版本。",
          },
        };
      }

      if (resume.action === "ESCALATE") {
        return {
          humanAction: resume.action,
          pendingInterrupt: null,
          terminalStage: "ESCALATED" as const,
          finalDecision: tightenedHumanDecision(
            currentDecision,
            "人工审核已升级给更高权限角色。",
          ),
        };
      }

      const mayApprove =
        currentDecision.blockingIssues.length === 0 &&
        currentDecision.evidenceCoverage.missingSources.length === 0 &&
        state.failures.length === 0;
      return {
        humanAction: resume.action,
        pendingInterrupt: null,
        terminalStage: "COMPLETED" as const,
        finalDecision: mayApprove
          ? {
              ...currentDecision,
              decision: "PASS" as const,
              publishable: true,
              summary: "人工审核确认继续流程。",
            }
          : tightenedHumanDecision(
              currentDecision,
              "人工动作不能绕过证据缺口、失败或 hard blocker。",
            ),
      };
    })
    .addNode("complete_review", (state: ReviewState) => ({
      terminalStage: state.terminalStage ?? "COMPLETED",
      pendingInterrupt: null,
    }))
    .addEdge(START, "input_validation")
    .addEdge("input_validation", "content_understanding")
    .addEdge("content_understanding", "review_planner")
    .addEdge("review_planner", "evidence_planning");

  graph
    .addEdge("evidence_planning", "public_relations_review")
    .addEdge("evidence_planning", "operations_review")
    .addEdge("evidence_planning", "product_review")
    .addEdge("evidence_planning", "customer_review")
    .addEdge("evidence_planning", "compliance_safety_review")
    .addEdge(
      [
        "public_relations_review",
        "operations_review",
        "product_review",
        "customer_review",
        "compliance_safety_review",
      ],
      "evidence_critic",
    )
    .addEdge("evidence_critic", "decision_judge")
    .addEdge("decision_judge", "policy_guard")
    .addConditionalEdges(
      "policy_guard",
      (state: ReviewState) => {
        const decision = requireValue(
          state.finalDecision,
          "finalDecision",
        ).decision;
        if (decision === "REVISE") return "revision_agent";
        if (decision === "HUMAN_REVIEW") return "await_human_review";
        return "complete_review";
      },
      ["revision_agent", "await_human_review", "complete_review"],
    )
    .addEdge("revision_agent", "await_human_review")
    .addConditionalEdges(
      "await_human_review",
      (state: ReviewState) =>
        state.humanAction === "REVISE" && state.terminalStage !== "ESCALATED"
          ? "content_understanding"
          : "complete_review",
      ["content_understanding", "complete_review"],
    )
    .addEdge("complete_review", END);

  const compiled = graph.compile({ checkpointer: options.checkpointer });
  compiled.name = "PR Review Five-Dimension Multi-Agent Graph";
  return compiled;
}
