import { ReviewStageSchema, type ReviewCase } from "../../algorithm/index.js";
import { RepositoryError } from "./errors.js";
import type {
  ContentVersionRepository,
  EvidenceRepository,
  RepositoryPage,
  ReviewActionRepository,
  ReviewCaseRepository,
  ReviewResultRepository,
  RevisionTransactionRepository,
} from "./ports.js";
import {
  ContentVersionRecordSchema,
  EvidenceSnapshotSchema,
  ReviewActionRecordSchema,
  ReviewCaseRecordSchema,
  RevisionTransactionInputSchema,
  RevisionTransactionResultSchema,
  StoredReviewResultSchema,
  type ContentVersionRecord,
  type EvidenceSnapshot,
  type ReviewActionRecord,
  type ReviewCaseRecord,
  type RevisionTransactionInput,
  type RevisionTransactionResult,
  type StoredReviewResult,
} from "./schemas.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const property of Object.values(value)) deepFreeze(property);
  return value;
}

function immutableClone<T>(value: T): T {
  return deepFreeze(clone(value));
}

export interface InMemoryReviewRepositoryOptions {
  now?: () => string;
}

export class InMemoryReviewRepository
  implements
    ReviewCaseRepository,
    ContentVersionRepository,
    ReviewResultRepository,
    EvidenceRepository,
    ReviewActionRepository,
    RevisionTransactionRepository
{
  private readonly cases = new Map<string, ReviewCaseRecord>();
  private readonly versions = new Map<string, ContentVersionRecord[]>();
  private readonly results = new Map<string, StoredReviewResult[]>();
  private readonly snapshots = new Map<string, EvidenceSnapshot[]>();
  private readonly snapshotsById = new Map<string, EvidenceSnapshot>();
  private readonly actions = new Map<string, ReviewActionRecord[]>();
  private sequence = 0;

  constructor(private readonly options: InMemoryReviewRepositoryOptions = {}) {}

  async createCase(record: ReviewCaseRecord): Promise<ReviewCaseRecord> {
    const parsed = ReviewCaseRecordSchema.parse(record);
    if (this.cases.has(parsed.case.id)) {
      throw new RepositoryError("DUPLICATE_RECORD", "Case already exists.", {
        caseId: parsed.case.id,
      });
    }
    this.cases.set(parsed.case.id, clone(parsed));
    return immutableClone(parsed);
  }

  async getCase(caseId: string): Promise<ReviewCaseRecord | null> {
    const record = this.cases.get(caseId);
    return record ? immutableClone(record) : null;
  }

  async updateCase(record: ReviewCaseRecord): Promise<ReviewCaseRecord> {
    const parsed = ReviewCaseRecordSchema.parse(record);
    const existing = this.cases.get(parsed.case.id);
    if (!existing) {
      throw new RepositoryError("NOT_FOUND", "Case does not exist.", {
        caseId: parsed.case.id,
      });
    }
    if (
      existing.case.version !== parsed.case.version ||
      existing.case.currentContent !== parsed.case.currentContent
    ) {
      throw new RepositoryError(
        "INVALID_STATE",
        "updateCase may only change currentStage/updatedAt; use the revision transaction for content changes.",
        { caseId: parsed.case.id },
      );
    }
    this.cases.set(parsed.case.id, clone(parsed));
    return immutableClone(parsed);
  }

  async listCases(input: {
    limit: number;
    cursor: string | null;
  }): Promise<RepositoryPage<ReviewCaseRecord>> {
    const start = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
    const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
    const records = [...this.cases.values()].sort((left, right) =>
      left.case.id.localeCompare(right.case.id),
    );
    const page = records.slice(safeStart, safeStart + input.limit);
    const nextIndex = safeStart + page.length;
    return {
      data: page.map(immutableClone),
      nextCursor: nextIndex < records.length ? String(nextIndex) : null,
    };
  }

  async appendVersion(
    record: ContentVersionRecord,
  ): Promise<ContentVersionRecord> {
    const parsed = ContentVersionRecordSchema.parse(record);
    const versions = this.versions.get(parsed.caseId) ?? [];
    if (versions.some((version) => version.version === parsed.version)) {
      throw new RepositoryError("DUPLICATE_RECORD", "Version already exists.", {
        caseId: parsed.caseId,
        version: parsed.version,
      });
    }
    versions.push(clone(parsed));
    this.versions.set(parsed.caseId, versions);
    return immutableClone(parsed);
  }

  async getVersion(
    caseId: string,
    version: number,
  ): Promise<ContentVersionRecord | null> {
    const record = this.versions
      .get(caseId)
      ?.find((candidate) => candidate.version === version);
    return record ? immutableClone(record) : null;
  }

  async listVersions(caseId: string): Promise<ContentVersionRecord[]> {
    return (this.versions.get(caseId) ?? [])
      .slice()
      .sort((left, right) => left.version - right.version)
      .map(immutableClone);
  }

  async appendResult(record: StoredReviewResult): Promise<StoredReviewResult> {
    const parsed = StoredReviewResultSchema.parse(record);
    const results = this.results.get(parsed.caseId) ?? [];
    if (results.some((result) => result.resultId === parsed.resultId)) {
      throw new RepositoryError("DUPLICATE_RECORD", "Result already exists.", {
        resultId: parsed.resultId,
      });
    }
    results.push(clone(parsed));
    this.results.set(parsed.caseId, results);
    return immutableClone(parsed);
  }

  async listResults(caseId: string): Promise<StoredReviewResult[]> {
    return (this.results.get(caseId) ?? []).map(immutableClone);
  }

  async getLatestResult(caseId: string): Promise<StoredReviewResult | null> {
    const results = this.results.get(caseId) ?? [];
    const latest = [...results].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0];
    return latest ? immutableClone(latest) : null;
  }

  async appendSnapshot(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot> {
    const parsed = EvidenceSnapshotSchema.parse(snapshot);
    if (this.snapshotsById.has(parsed.snapshotId)) {
      throw new RepositoryError(
        "DUPLICATE_RECORD",
        "Evidence snapshot already exists.",
        { snapshotId: parsed.snapshotId },
      );
    }
    const snapshots = this.snapshots.get(parsed.caseId) ?? [];
    snapshots.push(clone(parsed));
    this.snapshots.set(parsed.caseId, snapshots);
    this.snapshotsById.set(parsed.snapshotId, clone(parsed));
    return immutableClone(parsed);
  }

  async listSnapshots(caseId: string): Promise<EvidenceSnapshot[]> {
    return (this.snapshots.get(caseId) ?? []).map(immutableClone);
  }

  async getSnapshot(snapshotId: string): Promise<EvidenceSnapshot | null> {
    const snapshot = this.snapshotsById.get(snapshotId);
    return snapshot ? immutableClone(snapshot) : null;
  }

  async appendAction(record: ReviewActionRecord): Promise<ReviewActionRecord> {
    const parsed = ReviewActionRecordSchema.parse(record);
    const actions = this.actions.get(parsed.caseId) ?? [];
    if (actions.some((action) => action.actionId === parsed.actionId)) {
      throw new RepositoryError("DUPLICATE_RECORD", "Action already exists.", {
        actionId: parsed.actionId,
      });
    }
    actions.push(clone(parsed));
    this.actions.set(parsed.caseId, actions);
    return immutableClone(parsed);
  }

  async listActions(caseId: string): Promise<ReviewActionRecord[]> {
    return (this.actions.get(caseId) ?? []).map(immutableClone);
  }

  async revise(
    input: RevisionTransactionInput,
  ): Promise<RevisionTransactionResult> {
    const parsedInput = RevisionTransactionInputSchema.parse(input);
    const existingCase = this.cases.get(parsedInput.caseId);
    if (!existingCase) {
      throw new RepositoryError("NOT_FOUND", "Case does not exist.", {
        caseId: parsedInput.caseId,
      });
    }

    if (existingCase.case.version !== parsedInput.expectedVersion) {
      throw new RepositoryError("VERSION_CONFLICT", "Case version changed.", {
        caseId: parsedInput.caseId,
        expectedVersion: parsedInput.expectedVersion,
        currentVersion: existingCase.case.version,
      });
    }

    const nextVersion = parsedInput.expectedVersion + 1;
    const versionRecord = ContentVersionRecordSchema.parse({
      versionId: this.nextId("version"),
      caseId: parsedInput.caseId,
      version: nextVersion,
      content: parsedInput.revisedContent,
      imageUrls: existingCase.case.imageUrls,
      targetPlatform: existingCase.case.targetPlatform,
      createdBy: parsedInput.actor,
      createdAt: parsedInput.timestamp,
    });
    const updatedCase = ReviewCaseRecordSchema.parse({
      case: {
        ...existingCase.case,
        currentContent: parsedInput.revisedContent,
        version: nextVersion,
        currentStage: ReviewStageSchema.parse("REQUESTER_SELF_CHECK"),
        updatedAt: parsedInput.timestamp,
      } satisfies ReviewCase,
      createdAt: existingCase.createdAt,
      updatedAt: parsedInput.timestamp,
    });
    const actionRecord = ReviewActionRecordSchema.parse({
      actionId: this.nextId("action"),
      caseId: parsedInput.caseId,
      action: {
        actor: parsedInput.actor,
        action: "REVISE",
        reason: parsedInput.reason,
        fromVersion: parsedInput.expectedVersion,
        toVersion: nextVersion,
        timestamp: parsedInput.timestamp,
      },
      createdAt: parsedInput.timestamp,
    });
    const result = RevisionTransactionResultSchema.parse({
      case: updatedCase.case,
      version: versionRecord,
      action: actionRecord,
    });

    this.versions.set(parsedInput.caseId, [
      ...(this.versions.get(parsedInput.caseId) ?? []),
      clone(versionRecord),
    ]);
    this.actions.set(parsedInput.caseId, [
      ...(this.actions.get(parsedInput.caseId) ?? []),
      clone(actionRecord),
    ]);
    this.cases.set(parsedInput.caseId, clone(updatedCase));

    return immutableClone(result);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${String(this.sequence).padStart(6, "0")}`;
  }

  currentTimestamp(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}
