import { timeLog, to } from "@nickyzj2023/utils";
import type { ChatCompletionMessageParam } from "openai/resources";
import { SUMMARIZE_PROMPT, SUMMARIZE_THRESHOLD } from "@/constants";
import { chatCompletions } from "./chat";
import { contentToMessage } from "./message";

/**
 * 估算消息数组占用的内存大小（字节）
 */
const estimateMessagesSize = (
	messages: ChatCompletionMessageParam[],
): number => {
	return JSON.stringify(messages).length * 2; // UTF-16 编码，每个字符 2 字节
};

/**
 * 移除消息中的图片，只保留最后一张
 */
const removeMostImages = (messages: ChatCompletionMessageParam[]): void => {
	// 收集所有包含图片的消息
	const imageMessages: ChatCompletionMessageParam[] = [];
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) {
			continue;
		}
		if (
			Array.isArray(message.content) &&
			message.content.some((part) => part.type === "image_url")
		) {
			imageMessages.push(message);
		}
	}

	// 如果没有图片或只有一张，不做处理
	if (imageMessages.length <= 1) {
		return;
	}

	// 保留最后一张图片，移除其他所有图片
	const lastImage = imageMessages.at(-1);
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message || message === lastImage) {
			continue;
		}

		messages.splice(i, 1);
	}

	timeLog(`内存超过10MB，已移除${imageMessages.length - 1}张图片，保留最后1张`);
};

/**
 * 上下文溢出时从前往后总结消息，保留系统消息
 * @param messages 原始消息数组，会被本函数修改
 * @returns 是否总结成功，失败时不会改变原数组
 */
export const summarizeMessages = async (
	messages: ChatCompletionMessageParam[],
) => {
	// 计算消息占用的内存大小，如果超过 10MB 则移除大部分图片
	const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
	const estimatedSize = estimateMessagesSize(messages);
	if (estimatedSize > MAX_SIZE_BYTES) {
		removeMostImages(messages);
	}

	if (messages.length < SUMMARIZE_THRESHOLD) {
		return false;
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
			return summarizingMessages.slice(
				i * countPerChunk,
				i * countPerChunk + countPerChunk,
			);
		},
	);
	timeLog(
		`准备总结前${count}条消息，分${summarizingMessagesChunks.length}次进行`,
	);

	// 开始总结
	// 使用 for 循环依次请求，而不是用 Promise.all，原因是部分模型对并发请求有严格限制
	const summarizedMessages: ChatCompletionMessageParam[] = [];
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
			contentToMessage(
				`清理了${chunk.length - 1}条消息并总结为：${summarizedCompletion.content}`,
			),
		);
	}

	// 修改原始消息数组
	messages.splice(startIndex, count, ...summarizedMessages);
	return true;
};
