import { SUMMARIZE_THRESHOLD } from "@/constants.js";
import type { GroupMessageEvent } from "@/schemas/onebot/http-post.js";
import type { Message } from "@/schemas/openai/index.js";
import {
  removeMostImages,
  saveGroupMessages,
  summarizeMessages,
} from "../openai/index.js";

/**
 * 调用大模型之后的生命周期，用于优化消息数组，保存到本地
 */
export const afterLLM = async (
  e: GroupMessageEvent,
  messages: Message[],
  info?: {
    isTokenNearLimit?: boolean;
  },
) => {
  const { group_id: groupId } = e;

  // 消息超过上下文长度时，先缩减大小
  if (info?.isTokenNearLimit) {
    removeMostImages(messages);
  }

  // 消息超过一定数量时，调用模型总结一部分
  if (messages.length > SUMMARIZE_THRESHOLD) {
    await summarizeMessages(messages);
  }

  // 保存消息到本地
  await saveGroupMessages(groupId, messages);
};
