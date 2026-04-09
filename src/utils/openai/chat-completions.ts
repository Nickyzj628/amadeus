import { IDENTITY_ANCHOR, MAX_REQUEST_COUNT, SAFE_WORD } from "@/constants.js";
import type {
  ChatCompletions,
  ChatCompletionUsage,
  Message,
} from "@/schemas/openai/index.js";
import { tools } from "@/tools/index.js";
import { fetcher } from "@nickyzj2023/utils";
import { modelRef } from "./index.js";

export const generateContent = async (messages: Message[]) => {
  if (!modelRef.value) {
    throw new Error("当前没有可用的模型，请完善配置文件");
  }

  /**
   * 巩固人设
   * 如果最后一条用户发言包含安全词，则在其之前插入提示词
   */

  let lastUserMessageIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );

  const lastUserMessage = messages[lastUserMessageIndex];
  if (lastUserMessage?.content.toString().includes(SAFE_WORD)) {
    messages.splice(lastUserMessageIndex, 0, {
      role: "system",
      content: IDENTITY_ANCHOR,
    });
    lastUserMessageIndex++;
  }

  /**
   * 发出请求
   * 单轮对话限制 `MAX_REQUEST_COUNT` 次请求
   */

  const { baseUrl, apiKey, model } = modelRef.value;
  const api = fetcher(baseUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let content = "";
  let usage: ChatCompletionUsage;

  for (let requestCount = 0; requestCount < MAX_REQUEST_COUNT; requestCount++) {
    const response = await api.post<ChatCompletions>("/chat/completions", {
      model,
      messages,
      tools,
    });

    const { message } = response.choices[0] ?? {};
    if (!message) {
      throw new Error("模型没有返回任何内容");
    }

    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
      }
    }

    // return {
    //   content: choices[0]?.message.content,
    //   isTokenNearLimit: usage?.total_tokens >= modelRef.value.totalContext * 0.8,
    // };
  }

  return {
    content,
    isTokenNearLimit: usage!.total_tokens >= modelRef.value.totalContext * 0.8,
  };

  // return {
  //   role: "assistant",
  //   content: normalizeText(result.text),
  //   tool_calls: result.toolCalls?.map((call) => ({
  //     id: call.toolCallId,
  //     type: "function",
  //     function: {
  //       name: call.toolName,
  //       arguments: JSON.stringify((call as any).args || (call as any).input),
  //     },
  //   })),
  // };
};
