import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { FakeListChatModel } from "@langchain/core/utils/testing";

/** Deterministic no-network provider for tests and keyless development. */
export function createMockReviewModel(): BaseChatModel {
  return new FakeListChatModel({ responses: [""] });
}
