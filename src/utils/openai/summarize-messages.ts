import { log, to } from "@nickyzj2023/utils";
import type { ModelMessage } from "ai";
import { SUMMARIZE_PROMPT, SUMMARIZE_THRESHOLD } from "@/constants.js";
import { chatCompletions } from "./chat-completions.js";
import { contentToMessage } from "./message.js";

/**
 * 上下文溢出时从前往后总结消息，但保留系统消息
 * @param messages 原始消息数组，会被本函数修改
 * @remarks 如果总结失败，则不改变原始数组
 */
export const summarizeMessages = async (messages: ModelMessage[]) => {
  if (messages.length < SUMMARIZE_THRESHOLD) {
    return;
  }

  // 从第一条用户消息开始总结
  const startIndex = messages.findIndex((message) => message.role === "user");

  // 粗略计算需要总结的消息条数
  const count = Math.floor(messages.length * 0.5);
  const endIndex = startIndex + count;
  const summarizingMessages = messages.slice(startIndex, endIndex);

  // 切片总结，防止一次性喂给模型的消息超过上下文窗口
  const countPerChunk = Math.min(count, SUMMARIZE_THRESHOLD);
  const summarizingMessagesChunks = Array.from(
    {
      length: Math.ceil(summarizingMessages.length / countPerChunk),
    },
    (_, i) => {
      return summarizingMessages.slice(i * countPerChunk, i * countPerChunk + countPerChunk);
    },
  );
  log(`准备总结前${count}条消息，分${summarizingMessagesChunks.length}次进行`);

  // 开始总结
  // 使用 for 循环依次请求，而不是用 Promise.all，原因是部分模型对并发请求有严格限制
  const summarizedMessages: ModelMessage[] = [];
  for (const chunk of summarizingMessagesChunks) {
    chunk.push(contentToMessage(SUMMARIZE_PROMPT));

    const [error, summarizedCompletion] = await to(
      chatCompletions(chunk, {
        disableMessagesOptimization: true,
      }),
    );
    if (error) {
      return false;
    }

    summarizedMessages.push(
      contentToMessage(`清理了${chunk.length - 1}条消息并总结为：${summarizedCompletion.content}`),
    );
  }

  // 修改原始消息数组
  messages.splice(startIndex, count, ...summarizedMessages);
};
