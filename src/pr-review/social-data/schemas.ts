import { z } from "zod";
import {
  CanonicalSocialPlatformSchema,
  FixtureProvenanceSchema,
  NonBlankStringSchema,
  SocialAccessModeSchema,
  SocialCommentSchema,
  SocialPostSchema,
} from "../algorithm/index.js";

export const Data002AccessModeSchema = z.enum([
  "local_fixture",
  "authorized_export",
]);
export type Data002AccessMode = z.infer<typeof Data002AccessModeSchema>;

export const SocialFixtureSchema = z.strictObject({
  schemaVersion: NonBlankStringSchema,
  platform: CanonicalSocialPlatformSchema,
  accessMode: Data002AccessModeSchema,
  provenance: FixtureProvenanceSchema,
  redactionNote: NonBlankStringSchema,
  posts: z.array(SocialPostSchema),
  comments: z.array(SocialCommentSchema),
});
export type SocialFixture = z.infer<typeof SocialFixtureSchema>;

export const SocialDataAdapterResultSchema = z.strictObject({
  platform: CanonicalSocialPlatformSchema,
  accessMode: SocialAccessModeSchema,
  postCount: z.number().int().min(0),
  commentCount: z.number().int().min(0),
});
export type SocialDataAdapterResult = z.infer<
  typeof SocialDataAdapterResultSchema
>;
