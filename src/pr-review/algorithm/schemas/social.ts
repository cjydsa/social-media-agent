import { z } from "zod";
import {
  IsoTimestampSchema,
  NonBlankIdSchema,
  NonBlankStringSchema,
  NonNegativeIntegerSchema,
} from "./common.js";

export const SocialPlatformSchema = z.enum([
  "weibo",
  "xiaohongshu",
  "douyin",
  "bilibili",
  "coolapk",
  "WEIBO",
  "XIAOHONGSHU",
  "DOUYIN",
  "BILIBILI",
  "COOLAPK",
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const CanonicalSocialPlatformSchema = z.enum([
  "WEIBO",
  "XIAOHONGSHU",
  "DOUYIN",
  "BILIBILI",
  "COOLAPK",
]);
export type CanonicalSocialPlatform = z.infer<
  typeof CanonicalSocialPlatformSchema
>;

export const SocialAccessModeSchema = z.enum([
  "official_api",
  "authorized_export",
  "local_fixture",
  "disabled",
]);
export type SocialAccessMode = z.infer<typeof SocialAccessModeSchema>;

export const FixtureProvenanceSchema = z.enum([
  "synthetic",
  "manually_curated",
  "authorized_export",
]);
export type FixtureProvenance = z.infer<typeof FixtureProvenanceSchema>;

export const SocialMediaTypeSchema = z.enum([
  "text",
  "image",
  "video",
  "mixed",
  "unknown",
]);
export type SocialMediaType = z.infer<typeof SocialMediaTypeSchema>;

export const SocialProviderStatusSchema = z.enum([
  "available",
  "partial",
  "unavailable",
]);
export type SocialProviderStatus = z.infer<typeof SocialProviderStatusSchema>;

const NullableCountSchema = NonNegativeIntegerSchema.nullable();

export const SocialTimeRangeSchema = z.strictObject({
  from: IsoTimestampSchema,
  to: IsoTimestampSchema,
});
export type SocialTimeRange = z.infer<typeof SocialTimeRangeSchema>;

export const SocialSourceSchema = z.strictObject({
  accessMode: SocialAccessModeSchema,
  sourceAdapter: z.string(),
  fetchedAt: IsoTimestampSchema,
});
export type SocialSource = z.infer<typeof SocialSourceSchema>;

export const SocialPostSchema = z.strictObject({
  platform: SocialPlatformSchema,
  postId: NonBlankIdSchema,
  canonicalUrl: z.string().nullable(),
  title: z.string().nullable(),
  text: z.string(),
  mediaType: SocialMediaTypeSchema,
  publishedAt: IsoTimestampSchema,
  collectedAt: IsoTimestampSchema,
  author: z.strictObject({
    authorIdHash: NonBlankIdSchema,
    displayName: z.string().nullable(),
    verifiedType: z.string().nullable(),
  }),
  engagement: z.strictObject({
    likes: NullableCountSchema,
    comments: NullableCountSchema,
    shares: NullableCountSchema,
    favorites: NullableCountSchema,
    views: NullableCountSchema,
  }),
  context: z.strictObject({
    hashtags: z.array(z.string()),
    keywords: z.array(z.string()),
    topic: z.string().nullable(),
    language: z.string(),
  }),
  source: SocialSourceSchema,
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

export const SocialCommentSchema = z.strictObject({
  platform: SocialPlatformSchema,
  commentId: NonBlankIdSchema,
  postId: NonBlankIdSchema,
  authorIdHash: NonBlankIdSchema,
  text: z.string(),
  publishedAt: IsoTimestampSchema,
  likes: NullableCountSchema,
  source: SocialSourceSchema,
});
export type SocialComment = z.infer<typeof SocialCommentSchema>;

export const SocialSearchInputSchema = z.strictObject({
  query: NonBlankStringSchema,
  timeRange: SocialTimeRangeSchema,
  limit: z.number().int().min(1),
});
export type SocialSearchInput = z.infer<typeof SocialSearchInputSchema>;

export const SocialSearchResultSchema = z.strictObject({
  platform: SocialPlatformSchema,
  accessMode: SocialAccessModeSchema,
  posts: z.array(SocialPostSchema),
  comments: z.array(SocialCommentSchema),
  collectedAt: IsoTimestampSchema,
  truncated: z.boolean(),
  nextCursor: z.string().nullable(),
  providerStatus: SocialProviderStatusSchema,
});
export type SocialSearchResult = z.infer<typeof SocialSearchResultSchema>;

export const SocialPlatformCoverageSchema = z.strictObject({
  platform: SocialPlatformSchema,
  status: SocialProviderStatusSchema,
  mentionCount: NonNegativeIntegerSchema,
  sampledPostCount: NonNegativeIntegerSchema,
  sampledCommentCount: NonNegativeIntegerSchema,
  reason: z.string().nullable(),
});
export type SocialPlatformCoverage = z.infer<
  typeof SocialPlatformCoverageSchema
>;

export const SocialNegativeSignalSchema = z.strictObject({
  id: NonBlankIdSchema,
  platform: SocialPlatformSchema,
  topic: NonBlankStringSchema,
  reason: NonBlankStringSchema,
  evidenceIds: z.array(NonBlankIdSchema),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});
export type SocialNegativeSignal = z.infer<typeof SocialNegativeSignalSchema>;

export const SocialContextQuerySchema = z.strictObject({
  query: NonBlankStringSchema,
  platforms: z.array(SocialPlatformSchema),
  timeRange: SocialTimeRangeSchema,
});
export type SocialContextQuery = z.infer<typeof SocialContextQuerySchema>;

export const SocialContextSnapshotSchema = z.strictObject({
  query: z.string(),
  platforms: z.array(SocialPlatformSchema),
  timeRange: SocialTimeRangeSchema,
  mentionCount: NonNegativeIntegerSchema,
  sentimentDistribution: z.strictObject({
    positive: NullableCountSchema,
    neutral: NullableCountSchema,
    negative: NullableCountSchema,
    unknown: NullableCountSchema,
  }),
  topTopics: z.array(
    z.strictObject({
      topic: z.string(),
      count: NonNegativeIntegerSchema,
      evidenceIds: z.array(NonBlankIdSchema),
    }),
  ),
  emergingRisks: z.array(
    z.strictObject({
      label: z.string(),
      reason: z.string(),
      evidenceIds: z.array(NonBlankIdSchema),
    }),
  ),
  representativePosts: z.array(SocialPostSchema),
  representativeComments: z.array(SocialCommentSchema),
  negativeSignals: z.array(SocialNegativeSignalSchema),
  platformCoverage: z.array(SocialPlatformCoverageSchema),
  providerStatus: SocialProviderStatusSchema,
  evidenceIds: z.array(NonBlankIdSchema),
  generatedAt: IsoTimestampSchema,
  coverage: z.strictObject({
    requestedPlatforms: z.array(SocialPlatformSchema),
    availablePlatforms: z.array(SocialPlatformSchema),
    unavailablePlatforms: z.array(SocialPlatformSchema),
    isPartial: z.boolean(),
  }),
});
export type SocialContextSnapshot = z.infer<typeof SocialContextSnapshotSchema>;
