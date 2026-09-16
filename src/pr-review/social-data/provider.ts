import {
  SocialContextQuerySchema,
  type CanonicalSocialPlatform,
  type SocialContextProvider,
  type SocialContextQuery,
  type SocialContextSnapshot,
  type SocialSearchResult,
} from "../algorithm/index.js";
import { SocialDataError } from "./errors.js";
import { normalizeSocialPlatforms } from "./platforms.js";
import type { SocialDataAdapter } from "./ports.js";
import { buildSocialContextSnapshot } from "./context-builder.js";

export interface SocialContextProviderOptions {
  adapters: SocialDataAdapter[];
  now?: () => string;
}

export class SocialContextProviderMvp implements SocialContextProvider {
  constructor(private readonly options: SocialContextProviderOptions) {}

  async getSnapshot(input: SocialContextQuery): Promise<SocialContextSnapshot> {
    const query = SocialContextQuerySchema.parse(input);
    const requestedPlatforms = normalizeSocialPlatforms(query.platforms);
    const results: SocialSearchResult[] = [];
    const unavailablePlatforms: Array<{
      platform: CanonicalSocialPlatform;
      reason: string;
    }> = [];

    for (const platform of requestedPlatforms) {
      const adapter = this.options.adapters.find(
        (candidate) => candidate.platform === platform,
      );
      if (!adapter) {
        unavailablePlatforms.push({
          platform,
          reason: "No DATA-002 adapter configured for platform.",
        });
        continue;
      }

      try {
        results.push(
          await adapter.search({
            query: query.query,
            timeRange: query.timeRange,
            limit: 20,
          }),
        );
      } catch (error) {
        unavailablePlatforms.push({
          platform,
          reason:
            error instanceof SocialDataError
              ? error.message
              : "Social data adapter failed.",
        });
      }
    }

    return buildSocialContextSnapshot({
      query,
      results,
      unavailablePlatforms,
      generatedAt: this.options.now?.() ?? new Date().toISOString(),
    });
  }
}
