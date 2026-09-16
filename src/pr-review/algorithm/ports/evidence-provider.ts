import type { EvidenceItem } from "../schemas/review-result.js";

export interface EvidenceQuery {
  caseId: string;
  version: number;
  currentContent: string;
  targetPlatform: string[];
}

export interface EvidenceProvider {
  retrieve(input: EvidenceQuery): Promise<EvidenceItem[]>;
}
