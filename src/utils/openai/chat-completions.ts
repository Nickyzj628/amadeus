import { IDENTITY_ANCHOR, MAX_REQUEST_COUNT, SAFE_WORD } from "@/constants.js";
import type {
  ChatCompletions,
  ChatCompletionUsage,
  Message,
} from "@/schemas/openai/index.js";
import { executeTool, openaiTools } from "@/tools/index.js";
import { fetcher } from "@nickyzj2023/utils";
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
   * 单轮对话限制 `MAX_REQUEST_COUNT` 次请求，防止无限调用工具
   */

  const { baseUrl, apiKey, model } = modelRef.value;
  const api = fetcher(baseUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let content = "";
  let usage: ChatCompletionUsage | null = null;

  console.log();
  console.time("本轮对话耗时");
  for (let i = 0; i <= MAX_REQUEST_COUNT; i++) {
    console.log("请求大模型", model, messages.at(-1));

    // 如果超过请求次数限制，则在最后一条消息追加警告
    if (i === MAX_REQUEST_COUNT) {
      messages.at(-1)!.content +=
        "\n**注意：已达到单轮对话请求次数限制，请立即结束工具调用并输出最终结果。**";
    }

    const response = await api.post<ChatCompletions>("/chat/completions", {
      model,
      messages,
      tools: openaiTools,
    });
    const { message } = response.choices[0] ?? {};
    if (!message) {
      throw new Error("模型没有返回任何内容");
    }
    messages.push(message);
    console.log("大模型回复", message);

    // 如果无需调用工具，则完成本轮对话
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      content = message.content;
      usage = response.usage;
      break;
    }

    // 批量调用本轮对话所需工具
    const toolCallResults = await Promise.all(
      message.tool_calls.map(async (toolCall) => {
        // 暂不支持 function 以外的类型
        if (toolCall.type !== "function") {
          return "调用失败：暂不支持 function 以外的工具类型";
        }

        const { name, arguments: args } = toolCall.function;
        let result = await executeTool(name, JSON.parse(args));
        if (!result) {
          return "调用失败：工具返回了空结果";
        }
        // console.log(`调用了工具${name}(${args})`, result);
        return result;
      }),
    );

    // 推入工具调用结果
    messages.push(
      ...toolCallResults.map((result, i) =>
        contentToMessage(result, {
          role: "tool",
          tool_call_id: message.tool_calls![i]!.id,
        }),
      ),
    );
  }
  console.timeEnd("本轮对话耗时");
  console.log();

  return {
    content,
    isTokenNearLimit: usage!.total_tokens >= modelRef.value.totalContext * 0.8,
  };
};
