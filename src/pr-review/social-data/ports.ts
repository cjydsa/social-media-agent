import type {
  SocialAccessMode,
  SocialPlatform,
  SocialSearchInput,
  SocialSearchResult,
} from "../algorithm/index.js";

export interface SocialDataAdapter {
  readonly platform: SocialPlatform;
  readonly accessMode: SocialAccessMode;
  search(input: SocialSearchInput): Promise<SocialSearchResult>;
}
