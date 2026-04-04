import { ANCHOR_THRESHOLD, IDENTITY_ANCHOR, SAFE_WORD } from "@/constants.js";
import type { Message } from "@/schemas/openai.js";
import { tools as localTools } from "@/tools/index.js";
import { generateText, stepCountIs } from "ai";
import { normalizeText } from "../common.js";
import { createModel, getAllMcpTools, modelRef, type McpTool } from "./index.js";

export const chatCompletions = async (messages: Message[]) => {
  if (!modelRef.config) {
    throw new Error("当前没有可用的模型，请完善配置文件");
  }

  // 找到最后一条用户消息
  let lastUserMessageIndex = messages.findLastIndex((message) => message.role === "user");
  const lastUserMessage = messages[lastUserMessageIndex];
  const canOptimize = lastUserMessageIndex === messages.length - 1;

  // 如果消息中包含安全词，则在用户提问前加强人设
  if (lastUserMessage !== undefined && lastUserMessage.content.toString().includes(SAFE_WORD)) {
    messages.splice(lastUserMessageIndex, 0, {
      role: "system",
      content: IDENTITY_ANCHOR,
    });
    lastUserMessage.content = lastUserMessage.content.replace(SAFE_WORD, "");
    lastUserMessageIndex++;
  }

  /**
   * 如果消息超过 X 条，则在用户提问前添加临时人设锚点
   */
  const needTempIdentityAnchor =
    !canOptimize && messages.length > ANCHOR_THRESHOLD && lastUserMessageIndex !== -1;

  if (needTempIdentityAnchor) {
    messages.splice(lastUserMessageIndex, 0, {
      role: "system",
      content: IDENTITY_ANCHOR,
    });
  }

  /**
   * 使用 Vercel AI SDK 生成回复
   */
  // 获取 MCP 工具（首次调用时会自动初始化）并合并到本地工具
  const mcpTools = await getAllMcpTools();
  const mcpToolsRecord = mcpTools.reduce<Record<string, McpTool>>((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {});

  const allTools = {
    ...localTools,
    ...mcpToolsRecord,
  };

  const result = await generateText({
    model: createModel(),
    messages: messages,
    tools: allTools,
    stopWhen: stepCountIs(5), // 最多 5 轮工具调用
  });

  // 如果启用了临时人设锚点，则在消费后移除
  if (needTempIdentityAnchor) {
    messages.splice(lastUserMessageIndex, 1);
  }

  // 将生成的消息添加到历史
  if (result.response.messages && result.response.messages.length > 0) {
    messages.push(...result.response.messages);
  }

  // 同步 messages 回原数组
  messages.length = 0;
  messages.push(...messages);

  return {
    role: "assistant" as const,
    content: normalizeText(result.text),
    tool_calls: result.toolCalls?.map((call) => ({
      id: call.toolCallId,
      type: "function" as const,
      function: {
        name: call.toolName,
        arguments: JSON.stringify((call as any).args || (call as any).input),
      },
    })),
  };
};
