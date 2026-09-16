import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  AuthorizedExportSocialAdapter,
  LocalFixtureSocialAdapter,
  SocialContextProviderMvp,
  SocialDataError,
  normalizeSocialComment,
  normalizeSocialPost,
} from "../../../src/pr-review/social-data/index.js";
import type { SocialFixture } from "../../../src/pr-review/social-data/index.js";

const timestamp = "2026-09-01T02:00:00.000Z";
const fixturePaths = [
  "evals/pr-review/fixtures/social/weibo/fixture.json",
  "evals/pr-review/fixtures/social/xiaohongshu/fixture.json",
  "evals/pr-review/fixtures/social/douyin/fixture.json",
  "evals/pr-review/fixtures/social/bilibili/fixture.json",
  "evals/pr-review/fixtures/social/coolapk/fixture.json",
];

function readFixture(path: string): SocialFixture {
  return JSON.parse(readFileSync(path, "utf8")) as SocialFixture;
}

function createSearchInput(query = "用户") {
  return {
    query,
    timeRange: { from: timestamp, to: timestamp },
    limit: 20,
  };
}

describe("DATA-002 social data adapters", () => {
  it("loads five synthetic local fixtures with provenance", () => {
    const fixtures = fixturePaths.map(readFixture);
    expect(fixtures).toHaveLength(5);
    expect(
      fixtures.every((fixture) => fixture.provenance === "synthetic"),
    ).toBe(true);
    expect(fixtures.map((fixture) => fixture.platform)).toEqual([
      "WEIBO",
      "XIAOHONGSHU",
      "DOUYIN",
      "BILIBILI",
      "COOLAPK",
    ]);
  });

  it("implements local fixture adapter search without real network calls", async () => {
    const adapter = new LocalFixtureSocialAdapter(readFixture(fixturePaths[0]));
    const result = await adapter.search(createSearchInput("续航"));

    expect(adapter.platform).toBe("WEIBO");
    expect(adapter.accessMode).toBe("local_fixture");
    expect(result.providerStatus).toBe("available");
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.engagement.likes).toBeNull();
  });

  it("supports empty successful results separately from unavailable providers", async () => {
    const adapter = new LocalFixtureSocialAdapter(readFixture(fixturePaths[0]));
    const empty = await adapter.search(createSearchInput("不存在的合成关键词"));
    expect(empty.providerStatus).toBe("available");
    expect(empty.posts).toHaveLength(0);

    const provider = new SocialContextProviderMvp({
      adapters: [],
      now: () => timestamp,
    });
    const unavailable = await provider.getSnapshot({
      query: "续航",
      platforms: ["WEIBO"],
      timeRange: { from: timestamp, to: timestamp },
    });
    expect(unavailable.providerStatus).toBe("unavailable");
    expect(unavailable.platformCoverage[0]).toMatchObject({
      platform: "WEIBO",
      status: "unavailable",
    });
  });

  it("rejects malformed fixtures and invalid access modes", () => {
    expect(() => new LocalFixtureSocialAdapter({ platform: "WEIBO" })).toThrow(
      SocialDataError,
    );
    expect(
      () =>
        new LocalFixtureSocialAdapter({
          ...readFixture(fixturePaths[0]),
          accessMode: "authorized_export",
          provenance: "authorized_export",
        }),
    ).toThrow("local_fixture");
  });

  it("supports authorized export adapter only with authorized provenance", async () => {
    const fixture = {
      ...readFixture(fixturePaths[0]),
      accessMode: "authorized_export",
      provenance: "authorized_export",
      posts: readFixture(fixturePaths[0]).posts.map((post) => ({
        ...post,
        source: { ...post.source, accessMode: "authorized_export" },
      })),
      comments: readFixture(fixturePaths[0]).comments.map((comment) => ({
        ...comment,
        source: { ...comment.source, accessMode: "authorized_export" },
      })),
    };
    const adapter = new AuthorizedExportSocialAdapter(fixture);
    const result = await adapter.search(createSearchInput("续航"));
    expect(adapter.accessMode).toBe("authorized_export");
    expect(result.accessMode).toBe("authorized_export");
  });

  it("deduplicates posts/comments by platform and id", async () => {
    const fixture = readFixture(fixturePaths[0]);
    const adapter = new LocalFixtureSocialAdapter({
      ...fixture,
      posts: [fixture.posts[0], fixture.posts[0]],
      comments: [fixture.comments[0], fixture.comments[0]],
    });
    const result = await adapter.search(createSearchInput("续航"));
    expect(result.posts).toHaveLength(1);
    expect(result.comments).toHaveLength(1);
  });

  it("normalizes timestamps and redacts unrelated personal data", () => {
    const fixture = readFixture(fixturePaths[0]);
    const post = normalizeSocialPost({
      ...fixture.posts[0],
      platform: "weibo",
      publishedAt: "2026-09-01T10:00:00+08:00",
      text: "请联系 user@example.com 或 13800138000 处理投诉",
    });
    const comment = normalizeSocialComment({
      ...fixture.comments[0],
      platform: "weibo",
      publishedAt: "2026-09-01T10:00:00+08:00",
      text: "手机号 13800138000 不应出现在证据中",
    });

    expect(post.platform).toBe("WEIBO");
    expect(post.publishedAt).toBe("2026-09-01T02:00:00.000Z");
    expect(post.text).toContain("[REDACTED_EMAIL]");
    expect(post.text).toContain("[REDACTED_PHONE]");
    expect(comment.text).toContain("[REDACTED_PHONE]");
  });

  it("builds SocialContextSnapshot coverage and negative signals", async () => {
    const provider = new SocialContextProviderMvp({
      adapters: [new LocalFixtureSocialAdapter(readFixture(fixturePaths[0]))],
      now: () => timestamp,
    });
    const snapshot = await provider.getSnapshot({
      query: "续航",
      platforms: ["WEIBO", "DOUYIN"],
      timeRange: { from: timestamp, to: timestamp },
    });

    expect(snapshot.providerStatus).toBe("partial");
    expect(snapshot.platformCoverage).toHaveLength(2);
    expect(snapshot.coverage.unavailablePlatforms).toEqual(["DOUYIN"]);
    expect(snapshot.negativeSignals[0]?.reason).toContain("公关/客户风险证据");
  });
});
