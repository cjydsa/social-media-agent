import { describe, expect, it } from "@jest/globals";
import {
  KnowledgeDocumentSchema,
  LocalKnowledgeRetriever,
  loadKnowledgeDocumentsFromDirectory,
} from "../../../src/pr-review/algorithm/index.js";

describe("ALG-004 local versioned RAG", () => {
  it("loads versioned knowledge documents", () => {
    const documents = loadKnowledgeDocumentsFromDirectory("knowledge");
    expect(documents.length).toBeGreaterThanOrEqual(6);
    expect(
      documents.every(
        (document) => KnowledgeDocumentSchema.safeParse(document).success,
      ),
    ).toBe(true);
    expect(new Set(documents.map((document) => document.sourceType))).toEqual(
      new Set(["BRAND", "PRODUCT", "COMPLIANCE", "CUSTOMER", "PLATFORM", "PR"]),
    );
  });

  it("retrieves with BM25, simple vector score, RRF, and EvidenceItem mapping", async () => {
    const retriever = new LocalKnowledgeRetriever({
      documents: loadKnowledgeDocumentsFromDirectory("knowledge"),
      knowledgeVersion: "knowledge-2026-09-01",
    });
    const result = await retriever.retrieve({
      query: "行业第一 产品 声明 证据",
      sourceTypes: ["PRODUCT"],
      topK: 2,
    });

    expect(result.knowledgeVersion).toBe("knowledge-2026-09-01");
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.documents[0]?.document.sourceType).toBe("PRODUCT");
    expect(result.documents[0]?.bm25Score).toBeGreaterThan(0);
    expect(result.documents[0]?.vectorScore).toBeGreaterThan(0);
    expect(result.documents[0]?.rrfScore).toBeGreaterThan(0);
    expect(result.documents[0]?.evidence.source).toContain(
      "knowledgeVersion=knowledge-2026-09-01",
    );
    expect(result.documents[0]?.evidence.score).toBeLessThanOrEqual(1);
  });

  it("returns an empty result for unmatched source filters without failing open", async () => {
    const retriever = new LocalKnowledgeRetriever({
      documents: loadKnowledgeDocumentsFromDirectory("knowledge"),
      knowledgeVersion: "knowledge-2026-09-01",
    });
    const result = await retriever.retrieve({
      query: "产品",
      sourceTypes: [],
      topK: 3,
    });
    expect(result.documents).toHaveLength(3);
  });
});
