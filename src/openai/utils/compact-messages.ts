import type { ChatCompletions } from "@nickyzj2023/utils";
import { logger, to } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "@/constants.js";
import { generateContent } from "./generate-content.js";
import { saveGroupMessages } from "./group-messages.js";
import { contentToMessage } from "./message.js";

/**
 * 移除消息中的图片，只保留最后一张
 */
const removeMostImages = (messages: ChatCompletions.Message[]) => {
	// 收集所有包含图片的消息
	const imageMessages: ChatCompletions.Message[] = [];
	for (const message of messages) {
		if (
			message &&
			Array.isArray(message.content) &&
			message.content.some((part) => part.type === "image_url")
		) {
			imageMessages.push(message);
		}
	}

	// 如果没有图片，则不做处理
	if (imageMessages.length <= 1) {
		return;
	}

	// 移除所有图片，仅保留最后一张
	// 倒序遍历避免索引错乱
	const lastImage = imageMessages.at(-1);
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message && imageMessages.includes(message) && message !== lastImage) {
			messages.splice(i, 1);
		}
	}

	logger(`已移除${imageMessages.length - 1}张图片，保留了最后1张`);
};

/**
 * 从前往后总结消息，同时保留系统消息
 * @param messages 原始消息数组，会被本函数修改
 * @remarks 如果总结失败，则不改变原始数组
 */
export const summarizeMessages = async (
	messages: ChatCompletions.Message[],
) => {
	// 从第一条用户消息开始总结
	const startIndex = messages.findIndex((message) => message.role === "user");

	// 粗略计算需要总结的消息条数
	const count = Math.floor(messages.length * 0.5);
	const endIndex = startIndex + count;
	const summarizingMessages = messages.slice(startIndex, endIndex);

	// 切片总结，防止一次性喂给模型的消息超过上下文窗口
	const countPerChunk = Math.min(count, config.etc.summarizeThreshold);
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
	logger(
		`准备总结前${count}条消息，分${summarizingMessagesChunks.length}次进行`,
	);

	// 开始总结
	// 使用 for 循环依次请求，而不是用 Promise.all，原因是部分模型对并发请求有严格限制
	const summarizedMessages: ChatCompletions.Message[] = [];
	for (const chunk of summarizingMessagesChunks) {
		chunk.push(
			contentToMessage(SUMMARIZE_PROMPT, { role: "system" }),
			contentToMessage("开始总结聊天摘要", { role: "user" }),
		);

		const [error, summarized] = await to(
			generateContent(chunk, {
				extraBody: {
					tools: [],
					toolHandlers: [],
				},
			}),
		);
		if (error) {
			logger(`总结失败：${error.message}`);
			return false;
		}

		summarizedMessages.push(
			contentToMessage(`# 消息摘要\n${summarized.content}`),
		);
	}

	// 修改原始消息数组
	messages.splice(startIndex, count, ...summarizedMessages);
};

/**
 * 优化消息上下文，类似 AI Coding Agent 的 /compact 命令
 */
const compactMessages = async (
	messages: ChatCompletions.Message[],
	options?: {
		isTokenNearLimit?: boolean;
		shouldSave?: boolean;
		/** shouldSave=true 时必传此参数，否则会保存所有群的消息 */
		groupId?: number;
	},
) => {
	// 消息超过上下文长度时，先缩减大小
	if (options?.isTokenNearLimit) {
		removeMostImages(messages);
	}

	// 消息超过一定数量时，调用模型总结一部分
	if (messages.length > config.etc.summarizeThreshold) {
		await summarizeMessages(messages);
	}

	// 保存消息到本地
	if (options?.shouldSave) {
		await saveGroupMessages(options?.groupId, messages);
	}
};

export default compactMessages;
