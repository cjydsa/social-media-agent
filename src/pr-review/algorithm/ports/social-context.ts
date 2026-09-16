import type {
  SocialContextQuery,
  SocialContextSnapshot,
} from "../schemas/social.js";

export interface SocialContextProvider {
  getSnapshot(input: SocialContextQuery): Promise<SocialContextSnapshot>;
}
