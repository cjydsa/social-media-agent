// Contract DTO types mirrored from docs/pr-review/03-contracts.md (v1 + 12.7).
// The console never imports Backend/Algorithm code; these shapes are the
// frozen wire contract only.

export type ContentType =
  | "SOCIAL_POST"
  | "PRESS_RELEASE"
  | "PRODUCT_LAUNCH"
  | "BRAND_CAMPAIGN"
  | "EXTERNAL_RESPONSE"
  | "MULTIMODAL_POST";

export type ReviewStage =
  | "REQUESTER_SELF_CHECK"
  | "OPERATOR_REVIEW"
  | "VISUAL_REVIEW"
  | "COMPLIANCE_REVIEW"
  | "RISK_ROUTING"
  | "MEDIA_MANAGER_APPROVAL"
  | "SCHEDULING"
  | "COMPLETED"
  | "REJECTED"
  | "ESCALATED"
  | "REVIEW_REQUIRED";

export type ReviewActionType =
  | "APPROVE"
  | "REVISE"
  | "REJECT"
  | "ESCALATE"
  | "SUBMIT"
  | "AUTO_ROUTE"
  | "SCHEDULE";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FinalDecision = "PASS" | "REVISE" | "HUMAN_REVIEW" | "BLOCK";
export type DimensionVerdict = "PASS" | "WARN" | "BLOCK" | "REVIEW_REQUIRED";

export type ReviewDimension =
  | "PUBLIC_RELATIONS"
  | "OPERATIONS"
  | "PRODUCT"
  | "CUSTOMER"
  | "COMPLIANCE_SAFETY";

export interface ReviewCase {
  id: string;
  contentType: ContentType;
  targetPlatform: string[];
  originalContent: string;
  currentContent: string;
  imageUrls: string[];
  submitter: { id: string; displayName: string };
  version: number;
  currentStage: ReviewStage;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewIssue {
  id: string;
  category: string;
  severity: Severity;
  textSpan: { start: number; end: number; quote: string } | null;
  reason: string;
  evidenceIds: string[];
  suggestion: string | null;
}

export interface EvidenceItem {
  id: string;
  sourceType: string;
  title: string;
  content: string;
  source: string;
  score: number | null;
}

export interface DimensionReviewResult {
  dimension: ReviewDimension;
  riskScore: number;
  confidence: number;
  verdict: DimensionVerdict;
  reason: string;
  issues: ReviewIssue[];
  evidenceIds: string[];
  missingEvidence: string[];
  suggestedChanges: string[];
}

export interface EvidenceCoverage {
  requiredSources: string[];
  availableSources: string[];
  missingSources: string[];
  coverageScore: number;
}

export interface FinalReviewDecision {
  decision: FinalDecision;
  publishable: boolean;
  overallRiskScore: number;
  confidence: number;
  summary: string;
  dimensionResults: DimensionReviewResult[];
  blockingIssues: ReviewIssue[];
  revisionDirection: string[];
  evidenceCoverage: EvidenceCoverage;
  judgeReason: string;
}

export interface JudgeRecommendation {
  decision: FinalDecision;
  overallRiskScore: number;
  confidence: number;
  summary: string;
  topRisks: string[];
  revisionPriority: string[];
  judgeReason: string;
}

export interface ReviewResult {
  decision: string;
  riskLevel: RiskLevel;
  confidence: number;
  issues: ReviewIssue[];
  evidence: EvidenceItem[];
  suggestedRevision: string | null;
  reviewerType: string;
  reviewerName: string;
  latencyMs: number;
  modelUsage: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number | null;
    currency: string | null;
  };
}

export interface ReviewFailure {
  code: string;
  message: string;
  retryable: boolean;
  source: string;
  details: Record<string, unknown> | null;
}

export interface ReviewEngineOutput {
  caseId: string;
  version: number;
  results: ReviewResult[];
  aggregateResult: ReviewResult | null;
  nextStage: ReviewStage;
  requiresHuman: boolean;
  interrupt: {
    type: string;
    stage: ReviewStage;
    allowedActions: string[];
    reason: string;
    requiredRole: string;
  } | null;
  execution: { executionId: string; threadId: string; runId: string | null };
  failures: ReviewFailure[];
  reviewPlan?: {
    requiredDimensions: ReviewDimension[];
    reviewDepthByDimension: Record<ReviewDimension, "LIGHT" | "FULL">;
    requiredEvidenceSources: string[];
    requiresSocialContext: boolean;
    requiresProductKnowledge: boolean;
    requiresPlatformPolicy: boolean;
    requiresVisualAnalysis: boolean;
    planningReason: string;
  };
  evidenceCriticResult?: {
    supportedIssueIds: string[];
    unsupportedIssueIds: string[];
    conflicts: {
      dimensions: ReviewDimension[];
      reason: string;
      evidenceIds: string[];
    }[];
    missingEvidence: string[];
    requiresHuman: boolean;
    reason: string;
  };
  judgeRecommendation?: JudgeRecommendation;
  finalDecision?: FinalReviewDecision;
}

export interface ReviewDetailResponse {
  case: ReviewCase;
  latestResult: ReviewEngineOutput | null;
  allowedActions: ReviewActionType[];
}

export interface ReviewListResponse {
  data: ReviewCase[];
  page: { nextCursor: string | null };
}

export interface ReviewAction {
  actor: { id: string; displayName: string; role: string };
  action: ReviewActionType;
  reason: string;
  fromVersion: number | null;
  toVersion: number | null;
  timestamp: string;
}

export interface ReviewActionResponse {
  case: ReviewCase;
  action: ReviewAction;
}

export interface ContentVersionRecord {
  versionId: string;
  caseId: string;
  version: number;
  content: string;
  imageUrls: string[];
  targetPlatform: string[];
  createdBy: { id: string; displayName: string; role: string };
  createdAt: string;
}

export interface ReviewActionRecord {
  actionId: string;
  caseId: string;
  action: ReviewAction;
  createdAt: string;
}

export interface StoredReviewResult {
  resultId: string;
  caseId: string;
  version: number;
  executionId: string;
  output: ReviewEngineOutput;
  createdAt: string;
}

export interface EvidenceSnapshot {
  snapshotId: string;
  caseId: string;
  version: number;
  executionId: string;
  knowledgeVersion: string | null;
  socialContextVersion: string | null;
  evidenceItems: EvidenceItem[];
  createdAt: string;
}

export interface ReviewHistoryResponse {
  case: ReviewCase;
  versions: ContentVersionRecord[];
  actions: ReviewActionRecord[];
  results: StoredReviewResult[];
  evidenceSnapshots: EvidenceSnapshot[];
}

export interface PublishReceipt {
  receiptId: string;
  caseId: string;
  version: number;
  scheduledAt: string;
  mode: "mock";
  note: string;
}

export interface ScheduleReviewResponse {
  case: ReviewCase;
  action: ReviewAction;
  receipt: PublishReceipt;
}

export interface UploadedFile {
  url: string;
  fileName: string;
  size: number;
  mediaType: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
    requestId: string | null;
  };
}
