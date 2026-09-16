import {
  SocialSearchInputSchema,
  SocialSearchResultSchema,
  type SocialAccessMode,
  type SocialSearchInput,
  type SocialSearchResult,
} from "../../algorithm/index.js";
import { SocialDataError } from "../errors.js";
import {
  dedupeSocialComments,
  dedupeSocialPosts,
  normalizeSocialComment,
  normalizeSocialPost,
} from "../normalization.js";
import { normalizeSocialPlatform } from "../platforms.js";
import type { SocialDataAdapter } from "../ports.js";
import { SocialFixtureSchema, type SocialFixture } from "../schemas.js";

function containsQuery(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export class LocalFixtureSocialAdapter implements SocialDataAdapter {
  readonly platform;
  readonly accessMode: SocialAccessMode;
  private readonly fixture: SocialFixture;

  constructor(
    input: unknown,
    expectedAccessMode: SocialAccessMode = "local_fixture",
  ) {
    const parsed = SocialFixtureSchema.safeParse(input);
    if (!parsed.success) {
      throw new SocialDataError(
        "MALFORMED_INPUT",
        "Malformed social fixture.",
        {
          issues: parsed.error.issues.map((issue) => issue.message),
        },
      );
    }
    if (parsed.data.accessMode !== expectedAccessMode) {
      throw new SocialDataError(
        "INVALID_ACCESS_MODE",
        `Social adapter requires ${expectedAccessMode} access mode.`,
      );
    }
    this.fixture = parsed.data;
    this.platform = normalizeSocialPlatform(parsed.data.platform);
    this.accessMode = parsed.data.accessMode;
  }

  async search(input: SocialSearchInput): Promise<SocialSearchResult> {
    const parsedInput = SocialSearchInputSchema.parse(input);
    const posts = dedupeSocialPosts(this.fixture.posts.map(normalizeSocialPost))
      .filter((post) => containsQuery(post.text, parsedInput.query))
      .slice(0, parsedInput.limit);
    const comments = dedupeSocialComments(
      this.fixture.comments.map(normalizeSocialComment),
    )
      .filter((comment) => containsQuery(comment.text, parsedInput.query))
      .slice(0, parsedInput.limit);

    return SocialSearchResultSchema.parse({
      platform: this.platform,
      accessMode: this.accessMode,
      posts,
      comments,
      collectedAt:
        this.fixture.posts[0]?.collectedAt ?? parsedInput.timeRange.to,
      truncated:
        posts.length + comments.length >= parsedInput.limit &&
        this.fixture.posts.length + this.fixture.comments.length >
          posts.length + comments.length,
      nextCursor: null,
      providerStatus: "available",
    });
  }
}
