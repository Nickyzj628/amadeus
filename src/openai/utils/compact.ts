import type { AI, ChatCompletions } from "@nickyzj2023/utils";
import { logger, to } from "@nickyzj2023/utils";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { contentToMessage } from "./convert.js";
import { generateContent } from "./generate-content.js";
import { estimateTokens } from "./messages.js";
import { modelRef } from "./model.js";

/**
 * 软删除旧消息中的图片、音频和视频消息
 * @remarks 不会处理最新一条消息
 */
const softDeleteOldMediaMessages = (messages: AI.Message[]) => {
	const mediaTypes = new Set(["image_url", "input_audio", "video_url"]);
	let deletedCount = 0;

	for (const message of messages.slice(0, -1)) {
		if (
			Array.isArray(message.content) &&
			message.content.some((part) => mediaTypes.has(part.type))
		) {
			message.content = "资源已过期";
			deletedCount++;
		}
	}

	if (deletedCount > 0) {
		logger(`软删除了${deletedCount}条旧媒体消息`);
	}
};

/**
 * 从前往后总结消息，同时保留系统消息
 * @param messages 原始消息数组，会被本函数修改
 * @remarks 如果总结失败，则不改变原始数组
 */
export const summarizeMessages = async (messages: AI.Message[]) => {
	// 从第一条用户消息开始总结
	const startIndex = messages.findIndex((message) => message.role === "user");

	// 粗略计算需要总结的消息条数
	const count = Math.floor(messages.length * 0.8);
	const endIndex = startIndex + count;
	const summarizingMessages = messages.slice(startIndex, endIndex);

	// 切片总结，防止一次性喂给模型的消息超过上下文窗口
	const countPerChunk = Math.min(count, 100);
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
	const summarizedMessages: AI.Message[] = [];
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
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
const autoCompactMessages = async (
	messages: AI.Message[],
	options?: {
		/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值（80%） */
		usage?: ChatCompletions.Usage;
	},
) => {
	const { usage } = options ?? {};

	const thresholdTokens = (modelRef.current.context ?? 128000) * 0.8;
	const isTokenNearLimit = usage
		? usage.total_tokens > thresholdTokens
		: estimateTokens(messages) > thresholdTokens;
	if (!isTokenNearLimit) {
		return;
	}

	// 移除多模态消息
	softDeleteOldMediaMessages(messages);

	// 总结剩下的消息
	await summarizeMessages(messages);
};

export default autoCompactMessages;
