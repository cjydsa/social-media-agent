import { ChatDeepSeek } from "@langchain/deepseek";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { assertLLMConfigured } from "../../config/providers.js";
import { LLMConfig } from "../../config/types.js";

export interface DeepSeekSDKFields {
  model: string;
  apiKey: string;
  temperature: number;
  streamUsage: boolean;
}

export type DeepSeekSDKFactory = (fields: DeepSeekSDKFields) => BaseChatModel;

const defaultDeepSeekSDKFactory: DeepSeekSDKFactory = (fields) =>
  new ChatDeepSeek(fields);

/** Creates the official LangChain DeepSeek model from injected typed config. */
export function createDeepSeekModel(
  llm: LLMConfig,
  sdkFactory: DeepSeekSDKFactory = defaultDeepSeekSDKFactory,
): BaseChatModel {
  if (llm.provider !== "deepseek") {
    throw new Error("DeepSeek adapter requires LLM_PROVIDER=deepseek.");
  }
  assertLLMConfigured(llm);

  return sdkFactory({
    model: llm.model!,
    apiKey: llm.apiKey!.unwrap(),
    temperature: 0,
    streamUsage: true,
  });
}
