import {
  SocialContextSnapshotSchema,
  type CanonicalSocialPlatform,
  type SocialContextQuery,
  type SocialContextSnapshot,
  type SocialPlatformCoverage,
  type SocialSearchResult,
} from "../algorithm/index.js";
import { dedupeSocialComments, dedupeSocialPosts } from "./normalization.js";
import { normalizeSocialPlatforms } from "./platforms.js";

export interface SocialContextBuilderInput {
  query: SocialContextQuery;
  results: SocialSearchResult[];
  unavailablePlatforms?: Array<{
    platform: CanonicalSocialPlatform;
    reason: string;
  }>;
  generatedAt: string;
}

function topicFromText(text: string): string {
  const normalized = text.trim().split(/\s+/)[0];
  return normalized ? normalized.slice(0, 32) : "unknown";
}

function buildCoverage(
  results: readonly SocialSearchResult[],
  unavailablePlatforms: readonly {
    platform: CanonicalSocialPlatform;
    reason: string;
  }[],
): SocialPlatformCoverage[] {
  const available = results.map((result) => ({
    platform: result.platform,
    status: result.providerStatus,
    mentionCount: result.posts.length + result.comments.length,
    sampledPostCount: result.posts.length,
    sampledCommentCount: result.comments.length,
    reason:
      result.providerStatus === "available" ? null : "partial provider result",
  }));
  const unavailable = unavailablePlatforms.map(({ platform, reason }) => ({
    platform,
    status: "unavailable" as const,
    mentionCount: 0,
    sampledPostCount: 0,
    sampledCommentCount: 0,
    reason,
  }));
  return [...available, ...unavailable];
}

export function buildSocialContextSnapshot(
  input: SocialContextBuilderInput,
): SocialContextSnapshot {
  const requestedPlatforms = normalizeSocialPlatforms(input.query.platforms);
  const posts = dedupeSocialPosts(
    input.results.flatMap((result) => result.posts),
  );
  const comments = dedupeSocialComments(
    input.results.flatMap((result) => result.comments),
  );
  const platformCoverage = buildCoverage(
    input.results,
    input.unavailablePlatforms ?? [],
  );
  const availablePlatforms = normalizeSocialPlatforms(
    input.results
      .filter((result) => result.providerStatus === "available")
      .map((result) => result.platform),
  );
  const unavailablePlatforms = requestedPlatforms.filter(
    (platform) => !availablePlatforms.includes(platform),
  );
  const topics = [
    ...posts.map((post) => post.text),
    ...comments.map((comment) => comment.text),
  ]
    .map(topicFromText)
    .filter(Boolean);
  const uniqueTopics = [...new Set(topics)].slice(0, 5);
  const evidenceIds = [
    ...posts.map((post) => `social-post-${post.platform}-${post.postId}`),
    ...comments.map(
      (comment) => `social-comment-${comment.platform}-${comment.commentId}`,
    ),
  ];
  const providerStatus =
    unavailablePlatforms.length === requestedPlatforms.length
      ? "unavailable"
      : unavailablePlatforms.length > 0
        ? "partial"
        : "available";

  return SocialContextSnapshotSchema.parse({
    query: input.query.query,
    platforms: requestedPlatforms,
    timeRange: input.query.timeRange,
    mentionCount: posts.length + comments.length,
    sentimentDistribution: {
      positive: null,
      neutral: null,
      negative: null,
      unknown: posts.length + comments.length,
    },
    topTopics: uniqueTopics.map((topic) => ({
      topic,
      count: topics.filter((candidate) => candidate === topic).length,
      evidenceIds,
    })),
    emergingRisks: [],
    representativePosts: posts.slice(0, 5),
    representativeComments: comments.slice(0, 5),
    negativeSignals: comments
      .filter((comment) => /投诉|失望|差评|退款|故障|翻车/u.test(comment.text))
      .slice(0, 5)
      .map((comment) => ({
        id: `negative-${comment.platform}-${comment.commentId}`,
        platform: comment.platform,
        topic: topicFromText(comment.text),
        reason: "社媒评论中出现负面或投诉信号，作为公关/客户风险证据。",
        evidenceIds: [
          `social-comment-${comment.platform}-${comment.commentId}`,
        ],
        severity: "MEDIUM",
      })),
    platformCoverage,
    providerStatus,
    evidenceIds,
    generatedAt: input.generatedAt,
    coverage: {
      requestedPlatforms,
      availablePlatforms,
      unavailablePlatforms,
      isPartial: providerStatus !== "available",
    },
  });
}
