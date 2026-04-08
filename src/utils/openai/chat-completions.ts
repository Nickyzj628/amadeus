import { ANCHOR_THRESHOLD, IDENTITY_ANCHOR, SAFE_WORD } from "@/constants.js";
import type { ChatCompletions, Message } from "@/schemas/openai/index.js";
import { modelRef } from "./index.js";
import { fetcher } from "@nickyzj2023/utils";

export const generateContent = async (messages: Message[]) => {
  if (!modelRef.value) {
    throw new Error("当前没有可用的模型，请完善配置文件");
  }

  /**
   * 巩固人设
   */

  // 找到最后一条用户消息
  let lastUserMessageIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  const lastUserMessage = messages[lastUserMessageIndex];
  const canOptimize = lastUserMessageIndex === messages.length - 1;

  // 如果消息中包含安全词，则在用户提问前巩固人设
  if (
    lastUserMessage !== undefined &&
    lastUserMessage.content.toString().includes(SAFE_WORD)
  ) {
    messages.splice(lastUserMessageIndex, 0, {
      role: "system",
      content: IDENTITY_ANCHOR,
    });
    lastUserMessageIndex++;
  }
  // 如果消息超过 X 条，则在用户提问前添加人设锚点
  else if (
    canOptimize &&
    messages.length > ANCHOR_THRESHOLD &&
    lastUserMessageIndex !== -1
  ) {
    messages.splice(lastUserMessageIndex, 0, {
      role: "system",
      content: IDENTITY_ANCHOR,
    });
  }

  /**
   * 拼接 Function Calling Tools 参数
   */

  // 获取 MCP 工具（首次调用时会自动初始化）并合并到本地工具
  // const mcpTools = await getAllMcpTools();
  // const mcpToolsRecord = mcpTools.reduce<Record<string, McpTool>>(
  //   (acc, tool) => {
  //     acc[tool.name] = tool;
  //     return acc;
  //   },
  //   {},
  // );

  // const allTools = {
  //   ...localTools,
  //   ...mcpToolsRecord,
  // };

  // const result = await generateText({
  //   model: createModel(),
  //   messages: messages,
  //   tools: allTools,
  //   stopWhen: stepCountIs(5), // 最多 5 轮工具调用
  // });

  // 发出请求
  const api = fetcher(modelRef.value.baseUrl, {
    headers: {
      Authorization: `Bearer ${modelRef.value.apiKey}`,
    },
  });
  const { choices, usage } = await api.post<ChatCompletions>(
    "/chat/completions",
    {
      model: modelRef.value.model,
      messages,
    },
  );

  return {
    content: choices[0]?.message.content,
    isTokenNearLimit: usage?.total_tokens >= modelRef.value.totalContext * 0.8,
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
