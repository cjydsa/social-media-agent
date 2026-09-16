import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { assertLLMConfigured } from "../../config/providers.js";
import { LLMConfig } from "../../config/types.js";

export interface QwenSDKFields {
  model: string;
  apiKey: string;
  temperature: number;
  streamUsage: boolean;
  configuration: {
    apiKey: string;
    baseURL: string;
  };
}

export type QwenSDKFactory = (fields: QwenSDKFields) => BaseChatModel;

const defaultQwenSDKFactory: QwenSDKFactory = (fields) =>
  new ChatOpenAI(fields);

/** Creates a Qwen model through Model Studio's OpenAI-compatible endpoint. */
export function createQwenModel(
  llm: LLMConfig,
  sdkFactory: QwenSDKFactory = defaultQwenSDKFactory,
): BaseChatModel {
  if (llm.provider !== "qwen") {
    throw new Error("Qwen adapter requires LLM_PROVIDER=qwen.");
  }
  assertLLMConfigured(llm);

  const apiKey = llm.apiKey!.unwrap();
  return sdkFactory({
    model: llm.model!,
    apiKey,
    temperature: 0,
    streamUsage: true,
    configuration: {
      apiKey,
      baseURL: llm.baseUrl!,
    },
  });
}
