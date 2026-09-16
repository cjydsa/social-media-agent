import { describe, expect, it } from "@jest/globals";
import {
  SocialContextSnapshotSchema,
  SocialPostSchema,
  SocialSearchInputSchema,
  SocialSearchResultSchema,
} from "../../../src/pr-review/algorithm/index.js";
import type { SocialContextProvider } from "../../../src/pr-review/algorithm/index.js";
import {
  contractTimestamp,
  createSocialContextSnapshotFixture,
  createSocialPostFixture,
} from "./fixtures.js";

const fakeSocialContextProvider: SocialContextProvider = {
  async getSnapshot() {
    return SocialContextSnapshotSchema.parse(
      createSocialContextSnapshotFixture(),
    );
  },
};

describe("Social runtime contracts", () => {
  it("requires SocialPost fields and preserves null unknown engagement", () => {
    const parsed = SocialPostSchema.parse(createSocialPostFixture());
    expect(parsed.engagement).toEqual({
      likes: null,
      comments: null,
      shares: null,
      favorites: null,
      views: null,
    });

    const { postId: _postId, ...missingPostId } = createSocialPostFixture();
    expect(SocialPostSchema.safeParse(missingPostId).success).toBe(false);
  });

  it("rejects invalid platform, access mode, timestamp, and count", () => {
    const fixture = createSocialPostFixture();
    expect(
      SocialPostSchema.safeParse({ ...fixture, platform: "unknown-platform" })
        .success,
    ).toBe(false);
    expect(
      SocialPostSchema.safeParse({
        ...fixture,
        source: { ...fixture.source, accessMode: "scraper" },
      }).success,
    ).toBe(false);
    expect(
      SocialPostSchema.safeParse({
        ...fixture,
        publishedAt: "2026-08-31T08:00:00",
      }).success,
    ).toBe(false);
    expect(
      SocialPostSchema.safeParse({
        ...fixture,
        engagement: { ...fixture.engagement, likes: -1 },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown nested fields", () => {
    const fixture = createSocialPostFixture();
    expect(
      SocialPostSchema.safeParse({
        ...fixture,
        author: { ...fixture.author, privateProfile: true },
      }).success,
    ).toBe(false);
  });

  it("validates SocialSearchInput query and limit boundaries", () => {
    const validInput = {
      query: "contract query",
      timeRange: { from: contractTimestamp, to: contractTimestamp },
      limit: 20,
    };
    expect(SocialSearchInputSchema.safeParse(validInput).success).toBe(true);
    expect(
      SocialSearchInputSchema.safeParse({ ...validInput, query: "   " })
        .success,
    ).toBe(false);
    expect(
      SocialSearchInputSchema.safeParse({ ...validInput, limit: 0 }).success,
    ).toBe(false);
    expect(
      SocialSearchInputSchema.safeParse({ ...validInput, limit: 1.5 }).success,
    ).toBe(false);
  });

  it("keeps unavailable provider state explicit", () => {
    const result = SocialSearchResultSchema.parse({
      platform: "douyin",
      accessMode: "disabled",
      posts: [],
      comments: [],
      collectedAt: contractTimestamp,
      truncated: false,
      nextCursor: null,
      providerStatus: "unavailable",
    });
    expect(result.providerStatus).toBe("unavailable");

    const snapshot = SocialContextSnapshotSchema.parse(
      createSocialContextSnapshotFixture(),
    );
    expect(snapshot.coverage).toMatchObject({
      unavailablePlatforms: ["douyin"],
      isPartial: true,
    });
  });

  it("compiles a fake provider and preserves JSON semantics", async () => {
    const snapshot = await fakeSocialContextProvider.getSnapshot({
      query: "contract query",
      platforms: ["weibo", "douyin"],
      timeRange: { from: contractTimestamp, to: contractTimestamp },
    });
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(SocialContextSnapshotSchema.parse(roundTripped)).toEqual(snapshot);
  });
});
