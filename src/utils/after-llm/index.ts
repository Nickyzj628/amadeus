import type { GroupMessageEvent } from "@/schemas/onebot/http-post.js";
import type { Message } from "@/schemas/openai.js";
import { saveGroupMessages } from "../openai/group-messages.js";
import { pruneMessages } from "../openai/prune-messages.js";
import { summarizeMessages } from "../openai/summarize-messages.js";

/**
 * 调用大模型之后的生命周期，用于优化消息数组，保存到本地
 */
export const afterLLM = async (e: GroupMessageEvent, messages: Message[]) => {
  const { group_id: groupId } = e;

  // 消息超过一定内存时，自动修剪
  await pruneMessages(messages);

  // 消息超过一定数量时，自动总结一部分
  await summarizeMessages(messages);

  // 保存消息到本地
  await saveGroupMessages(groupId, messages);
};
