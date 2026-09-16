import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceItem } from "../schemas/review-result.js";
import {
  KnowledgeDocumentSchema,
  KnowledgeRetrievalQuerySchema,
  KnowledgeRetrievalResultSchema,
  type KnowledgeDocument,
  type KnowledgeRetrievalQuery,
  type KnowledgeRetrievalResult,
  type KnowledgeRetriever,
  type KnowledgeSourceType,
} from "./schemas.js";

interface ScoredDocument {
  document: KnowledgeDocument;
  bm25Score: number;
  vectorScore: number;
}

const RRF_K = 60;

function tokenize(text: string): string[] {
  const asciiTokens = text.toLocaleLowerCase().match(/[a-z0-9]+/g);
  const cjkTokens = [...text.matchAll(/[\p{Script=Han}]{1,2}/gu)].map(
    (match) => match[0],
  );
  return [...(asciiTokens ?? []), ...cjkTokens];
}

function termFrequency(tokens: readonly string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

function bm25Score(
  queryTokens: readonly string[],
  documentTokens: readonly string[],
  allDocumentTokens: readonly (readonly string[])[],
): number {
  const frequencies = termFrequency(documentTokens);
  const averageLength =
    allDocumentTokens.reduce((sum, tokens) => sum + tokens.length, 0) /
    Math.max(1, allDocumentTokens.length);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const token of new Set(queryTokens)) {
    const containingDocuments = allDocumentTokens.filter((tokens) =>
      tokens.includes(token),
    ).length;
    const idf = Math.log(
      1 +
        (allDocumentTokens.length - containingDocuments + 0.5) /
          (containingDocuments + 0.5),
    );
    const frequency = frequencies.get(token) ?? 0;
    const denominator =
      frequency + k1 * (1 - b + b * (documentTokens.length / averageLength));
    score += idf * ((frequency * (k1 + 1)) / Math.max(denominator, 1));
  }

  return score;
}

function cosineScore(
  queryTokens: readonly string[],
  documentTokens: readonly string[],
): number {
  const queryVector = termFrequency(queryTokens);
  const documentVector = termFrequency(documentTokens);
  const terms = new Set([...queryVector.keys(), ...documentVector.keys()]);
  let dot = 0;
  let queryMagnitude = 0;
  let documentMagnitude = 0;

  for (const term of terms) {
    const queryValue = queryVector.get(term) ?? 0;
    const documentValue = documentVector.get(term) ?? 0;
    dot += queryValue * documentValue;
    queryMagnitude += queryValue * queryValue;
    documentMagnitude += documentValue * documentValue;
  }

  if (queryMagnitude === 0 || documentMagnitude === 0) return 0;
  return dot / (Math.sqrt(queryMagnitude) * Math.sqrt(documentMagnitude));
}

function rankMap(
  documents: readonly ScoredDocument[],
  scoreKey: "bm25Score" | "vectorScore",
): Map<string, number> {
  return new Map(
    [...documents]
      .sort((left, right) => right[scoreKey] - left[scoreKey])
      .map((entry, index) => [entry.document.documentId, index + 1]),
  );
}

function rrfScore(
  documentId: string,
  rankMaps: readonly Map<string, number>[],
): number {
  return rankMaps.reduce((sum, ranks) => {
    const rank = ranks.get(documentId);
    return rank ? sum + 1 / (RRF_K + rank) : sum;
  }, 0);
}

function evidenceSource(
  sourceType: KnowledgeSourceType,
): EvidenceItem["sourceType"] {
  return sourceType === "BRAND" || sourceType === "PR"
    ? "BRAND_KNOWLEDGE"
    : "WEB";
}

function buildEvidenceItem(
  document: KnowledgeDocument,
  score: number,
  knowledgeVersion: string,
): EvidenceItem {
  return {
    id: `knowledge-${document.documentId}`,
    sourceType: evidenceSource(document.sourceType),
    title: document.title,
    content: document.content,
    source: `knowledge://${document.sourceType.toLowerCase()}/${document.documentId}@${document.version}?knowledgeVersion=${knowledgeVersion}`,
    score: Math.min(1, Math.max(0, score)),
  };
}

function collectJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

export function loadKnowledgeDocumentsFromDirectory(
  directory: string,
): KnowledgeDocument[] {
  if (!existsSync(directory)) return [];
  if (!statSync(directory).isDirectory()) return [];
  return collectJsonFiles(directory).map((file) =>
    KnowledgeDocumentSchema.parse(JSON.parse(readFileSync(file, "utf8"))),
  );
}

export interface LocalKnowledgeRetrieverOptions {
  documents: KnowledgeDocument[];
  knowledgeVersion: string;
}

export class LocalKnowledgeRetriever implements KnowledgeRetriever {
  private readonly documents: KnowledgeDocument[];
  private readonly knowledgeVersion: string;

  constructor(options: LocalKnowledgeRetrieverOptions) {
    this.documents = options.documents.map((document) =>
      KnowledgeDocumentSchema.parse(document),
    );
    this.knowledgeVersion = options.knowledgeVersion;
  }

  async retrieve(
    input: KnowledgeRetrievalQuery,
  ): Promise<KnowledgeRetrievalResult> {
    const query = KnowledgeRetrievalQuerySchema.parse(input);
    const candidates = this.documents.filter(
      (document) =>
        query.sourceTypes.length === 0 ||
        query.sourceTypes.includes(document.sourceType),
    );
    const queryTokens = tokenize(query.query);
    const tokenizedDocuments = candidates.map((document) =>
      tokenize(
        `${document.title} ${document.content} ${document.tags.join(" ")}`,
      ),
    );
    const scored = candidates.map((document, index) => {
      const documentTokens = tokenizedDocuments[index] ?? [];
      return {
        document,
        bm25Score: bm25Score(queryTokens, documentTokens, tokenizedDocuments),
        vectorScore: cosineScore(queryTokens, documentTokens),
      };
    });
    const bm25Ranks = rankMap(scored, "bm25Score");
    const vectorRanks = rankMap(scored, "vectorScore");
    const fused = scored
      .map((entry) => ({
        ...entry,
        rrfScore: rrfScore(entry.document.documentId, [bm25Ranks, vectorRanks]),
      }))
      .sort((left, right) => right.rrfScore - left.rrfScore)
      .slice(0, query.topK);
    const maxRrf = Math.max(...fused.map((entry) => entry.rrfScore), 1);

    return KnowledgeRetrievalResultSchema.parse({
      knowledgeVersion: this.knowledgeVersion,
      documents: fused.map((entry) => ({
        document: entry.document,
        bm25Score: entry.bm25Score,
        vectorScore: entry.vectorScore,
        rrfScore: entry.rrfScore,
        evidence: buildEvidenceItem(
          entry.document,
          entry.rrfScore / maxRrf,
          this.knowledgeVersion,
        ),
      })),
    });
  }
}
