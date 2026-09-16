import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * A LangChain chat model preserves structured output, tool calling, callbacks,
 * usage metadata, and LangSmith tracing capabilities for reviewer consumers.
 */
export type ReviewModel = BaseChatModel;
