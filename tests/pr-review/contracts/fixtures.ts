export const contractTimestamp = "2026-08-31T08:00:00.000Z";

export function createReviewCaseFixture() {
  return {
    id: "case_contract_01",
    contentType: "SOCIAL_POST" as const,
    targetPlatform: ["LINKEDIN"],
    originalContent: "Original contract content",
    currentContent: "Current contract content",
    imageUrls: [],
    submitter: { id: "user_contract_01", displayName: "Contract User" },
    version: 1,
    currentStage: "REQUESTER_SELF_CHECK" as const,
    createdAt: contractTimestamp,
    updatedAt: contractTimestamp,
  };
}

export function createReviewResultFixture() {
  return {
    decision: "APPROVE" as const,
    riskLevel: "LOW" as const,
    confidence: 0.9,
    issues: [],
    evidence: [
      {
        id: "evidence_contract_01",
        sourceType: "RULE" as const,
        title: "Contract evidence",
        content: "Deterministic contract-only evidence",
        source: "rule:contract-only",
        score: 0.8,
      },
    ],
    suggestedRevision: null,
    reviewerType: "RULE" as const,
    reviewerName: "contract-reviewer-v1",
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

export function createReviewResultWithSpan(
  currentContent: string,
  start: number,
  end: number,
) {
  return {
    ...createReviewResultFixture(),
    issues: [
      {
        id: "issue_contract_01",
        category: "BRAND" as const,
        severity: "LOW" as const,
        textSpan: {
          start,
          end,
          quote: currentContent.slice(start, end),
        },
        reason: "Contract span check",
        evidenceIds: ["evidence_contract_01"],
        suggestion: null,
      },
    ],
  };
}

export function createSocialPostFixture() {
  return {
    platform: "weibo" as const,
    postId: "post_contract_01",
    canonicalUrl: null,
    title: null,
    text: "明确标记为 contract-only 的测试文本",
    mediaType: "text" as const,
    publishedAt: contractTimestamp,
    collectedAt: contractTimestamp,
    author: {
      authorIdHash: "synthetic_hash_contract_01",
      displayName: null,
      verifiedType: null,
    },
    engagement: {
      likes: null,
      comments: null,
      shares: null,
      favorites: null,
      views: null,
    },
    context: {
      hashtags: [],
      keywords: ["contract-only"],
      topic: null,
      language: "zh-CN",
    },
    source: {
      accessMode: "local_fixture" as const,
      sourceAdapter: "contract-fixture",
      fetchedAt: contractTimestamp,
    },
  };
}

export function createSocialCommentFixture() {
  return {
    platform: "weibo" as const,
    commentId: "comment_contract_01",
    postId: "post_contract_01",
    authorIdHash: "synthetic_hash_contract_02",
    text: "Contract-only comment",
    publishedAt: contractTimestamp,
    likes: null,
    source: {
      accessMode: "local_fixture" as const,
      sourceAdapter: "contract-fixture",
      fetchedAt: contractTimestamp,
    },
  };
}

export function createSocialContextSnapshotFixture() {
  return {
    query: "contract query",
    platforms: ["weibo", "douyin"] as const,
    timeRange: { from: contractTimestamp, to: contractTimestamp },
    mentionCount: 1,
    sentimentDistribution: {
      positive: null,
      neutral: null,
      negative: null,
      unknown: 1,
    },
    topTopics: [
      { topic: "contract-only", count: 1, evidenceIds: ["social_ev_01"] },
    ],
    emergingRisks: [],
    representativePosts: [createSocialPostFixture()],
    representativeComments: [createSocialCommentFixture()],
    negativeSignals: [],
    platformCoverage: [
      {
        platform: "weibo" as const,
        status: "available" as const,
        mentionCount: 1,
        sampledPostCount: 1,
        sampledCommentCount: 1,
        reason: null,
      },
      {
        platform: "douyin" as const,
        status: "unavailable" as const,
        mentionCount: 0,
        sampledPostCount: 0,
        sampledCommentCount: 0,
        reason: "contract fixture unavailable platform",
      },
    ],
    providerStatus: "partial" as const,
    evidenceIds: ["social_ev_01"],
    generatedAt: contractTimestamp,
    coverage: {
      requestedPlatforms: ["weibo", "douyin"] as const,
      availablePlatforms: ["weibo"] as const,
      unavailablePlatforms: ["douyin"] as const,
      isPartial: true,
    },
  };
}
