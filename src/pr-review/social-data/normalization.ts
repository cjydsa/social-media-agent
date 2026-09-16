import {
  SocialCommentSchema,
  SocialPostSchema,
  type CanonicalSocialPlatform,
  type SocialComment,
  type SocialPost,
} from "../algorithm/index.js";
import { SocialDataError } from "./errors.js";
import { normalizeSocialPlatform } from "./platforms.js";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\b(?:\+?\d[\d -]{7,}\d)\b/g;

export function redactSocialText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]");
}

function canonicalizePost(
  post: SocialPost,
  platform: CanonicalSocialPlatform,
): SocialPost {
  return SocialPostSchema.parse({
    ...post,
    platform,
    text: redactSocialText(post.text.trim()),
    publishedAt: new Date(post.publishedAt).toISOString(),
    collectedAt: new Date(post.collectedAt).toISOString(),
    source: {
      ...post.source,
      accessMode: post.source.accessMode,
      fetchedAt: new Date(post.source.fetchedAt).toISOString(),
    },
  });
}

function canonicalizeComment(
  comment: SocialComment,
  platform: CanonicalSocialPlatform,
): SocialComment {
  return SocialCommentSchema.parse({
    ...comment,
    platform,
    text: redactSocialText(comment.text.trim()),
    publishedAt: new Date(comment.publishedAt).toISOString(),
    source: {
      ...comment.source,
      accessMode: comment.source.accessMode,
      fetchedAt: new Date(comment.source.fetchedAt).toISOString(),
    },
  });
}

export function normalizeSocialPost(input: unknown): SocialPost {
  const parsed = SocialPostSchema.safeParse(input);
  if (!parsed.success) {
    throw new SocialDataError("MALFORMED_INPUT", "Malformed social post.", {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  return canonicalizePost(
    parsed.data,
    normalizeSocialPlatform(parsed.data.platform),
  );
}

export function normalizeSocialComment(input: unknown): SocialComment {
  const parsed = SocialCommentSchema.safeParse(input);
  if (!parsed.success) {
    throw new SocialDataError("MALFORMED_INPUT", "Malformed social comment.", {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  return canonicalizeComment(
    parsed.data,
    normalizeSocialPlatform(parsed.data.platform),
  );
}

export function dedupeSocialPosts(posts: readonly SocialPost[]): SocialPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = `${post.platform}:${post.postId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeSocialComments(
  comments: readonly SocialComment[],
): SocialComment[] {
  const seen = new Set<string>();
  return comments.filter((comment) => {
    const key = `${comment.platform}:${comment.commentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
