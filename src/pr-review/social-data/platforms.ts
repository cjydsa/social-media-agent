import {
  CanonicalSocialPlatformSchema,
  SocialPlatformSchema,
  type CanonicalSocialPlatform,
  type SocialPlatform,
} from "../algorithm/index.js";
import { SocialDataError } from "./errors.js";

const PLATFORM_MAP: Record<SocialPlatform, CanonicalSocialPlatform> = {
  weibo: "WEIBO",
  xiaohongshu: "XIAOHONGSHU",
  douyin: "DOUYIN",
  bilibili: "BILIBILI",
  coolapk: "COOLAPK",
  WEIBO: "WEIBO",
  XIAOHONGSHU: "XIAOHONGSHU",
  DOUYIN: "DOUYIN",
  BILIBILI: "BILIBILI",
  COOLAPK: "COOLAPK",
};

export function normalizeSocialPlatform(
  platform: unknown,
): CanonicalSocialPlatform {
  const parsed = SocialPlatformSchema.safeParse(platform);
  if (!parsed.success) {
    throw new SocialDataError("INVALID_PLATFORM", "Unknown social platform.");
  }
  return CanonicalSocialPlatformSchema.parse(PLATFORM_MAP[parsed.data]);
}

export function normalizeSocialPlatforms(
  platforms: readonly SocialPlatform[],
): CanonicalSocialPlatform[] {
  return [...new Set(platforms.map(normalizeSocialPlatform))];
}
