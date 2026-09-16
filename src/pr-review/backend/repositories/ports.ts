import type {
  ContentVersionRecord,
  EvidenceSnapshot,
  ReviewActionRecord,
  ReviewCaseRecord,
  RevisionTransactionInput,
  RevisionTransactionResult,
  StoredReviewResult,
} from "./schemas.js";

export interface RepositoryPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ReviewCaseRepository {
  createCase(record: ReviewCaseRecord): Promise<ReviewCaseRecord>;
  getCase(caseId: string): Promise<ReviewCaseRecord | null>;
  /**
   * Stage-transition update (SPRINT-005). Only `case.currentStage` and
   * `case.updatedAt` may change; content/version mutations must go through
   * the revision transaction. Throws NOT_FOUND for unknown cases.
   */
  updateCase(record: ReviewCaseRecord): Promise<ReviewCaseRecord>;
  listCases(input: {
    limit: number;
    cursor: string | null;
  }): Promise<RepositoryPage<ReviewCaseRecord>>;
}

export interface ContentVersionRepository {
  appendVersion(record: ContentVersionRecord): Promise<ContentVersionRecord>;
  getVersion(
    caseId: string,
    version: number,
  ): Promise<ContentVersionRecord | null>;
  listVersions(caseId: string): Promise<ContentVersionRecord[]>;
}

export interface ReviewResultRepository {
  appendResult(record: StoredReviewResult): Promise<StoredReviewResult>;
  listResults(caseId: string): Promise<StoredReviewResult[]>;
  getLatestResult(caseId: string): Promise<StoredReviewResult | null>;
}

export interface EvidenceRepository {
  appendSnapshot(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot>;
  listSnapshots(caseId: string): Promise<EvidenceSnapshot[]>;
  getSnapshot(snapshotId: string): Promise<EvidenceSnapshot | null>;
}

export interface ReviewActionRepository {
  appendAction(record: ReviewActionRecord): Promise<ReviewActionRecord>;
  listActions(caseId: string): Promise<ReviewActionRecord[]>;
}

export interface RevisionTransactionRepository {
  revise(input: RevisionTransactionInput): Promise<RevisionTransactionResult>;
}
