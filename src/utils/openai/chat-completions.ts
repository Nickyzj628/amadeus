import { IDENTITY_ANCHOR, MAX_REQUEST_COUNT, SAFE_WORD } from "@/constants.js";
import type {
  ChatCompletions,
  ChatCompletionUsage,
  Message,
} from "@/schemas/openai/index.js";
import { executeTool, tools } from "@/tools/index.js";
import { fetcher, log } from "@nickyzj2023/utils";
import { contentToMessage, modelRef } from "./index.js";

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

  for (
    let requestCount = 0;
    requestCount <= MAX_REQUEST_COUNT;
    requestCount++
  ) {
    const response = await api.post<ChatCompletions>("/chat/completions", {
      model,
      messages,
      tools,
    });

    const { message } = response.choices[0] ?? {};
    if (!message) {
      throw new Error("模型没有返回任何内容");
    }

    // 如果无需调用工具，则结束本轮对话请求
    if (!message.tool_calls) {
      content = message.content;
      usage = response.usage;
      break;
    }

    for (
      let toolIndex = 0;
      toolIndex < message.tool_calls.length;
      toolIndex++
    ) {
      const toolCall = message.tool_calls[toolIndex]!;

      // 暂不支持 function 以外的类型
      if (toolCall.type !== "function") {
        continue;
      }

      const { name, arguments: args } = toolCall.function;
      let result = await executeTool(name, JSON.parse(args));
      if (!result) {
        continue;
      }

      // 如果达到单轮对话请求次数限制，则在最后一个工具的调用结果中强调禁止继续
      if (
        requestCount + 1 === MAX_REQUEST_COUNT &&
        toolIndex === message.tool_calls.length - 1
      ) {
        result +=
          "\n\n**注意：已达到单轮对话请求次数限制，请立即结束工具调用并输出结果。**";
      }

      messages.push(
        contentToMessage(result, {
          role: "tool",
          tool_call_id: toolCall.id,
        }),
      );
      log(`调用了${name}工具，参数：${args}，结果：${result}`);
    }
  }

  return {
    content,
    isTokenNearLimit: usage!.total_tokens >= modelRef.value.totalContext * 0.8,
  };
};
