import type { AI, ChatCompletions } from "@nickyzj2023/utils";
import { logger, to } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { contentToMessage } from "./convert.js";
import { generateContent } from "./generate-content.js";
import { estimateTokens } from "./messages.js";
import { modelRef } from "./model.js";

/**
 * 判断消息是否为带有工具调用的 assistant 消息
 */
const hasToolCalls = (message: AI.Message | undefined) =>
	message?.role === "assistant" && Array.isArray(message.tool_calls);

/**
 * 调整切点 endIndex，确保它不会落在 assistant(tool_calls) + tool 配对组中间
 * @param messages 完整消息数组
 * @param endIndex 初始切点，会把消息分为 [, endIndex) 和 [endIndex, ) 两段
 * @returns 调整后的 endIndex，保证切点两侧都不出现孤立的 assistant(tool_calls) 或 tool 消息
 * @remarks OpenAI API 要求 assistant(tool_calls) 和 tool 消息通过 tool_call_id 一一配对。
 * 如果切点落在配对组中间，两段消息都会出现孤立消息，导致 API 返回 400
 */
const alignToolGroupBoundary = (messages: AI.Message[], endIndex: number) => {
	// 确保 endIndex 不超出消息范围
	endIndex = Math.min(endIndex, messages.length);

	// 情况 1：被切掉部分的最后一条是带 tool_calls 的 assistant，
	// 但紧接着保留部分的开头不是对应的 tool 消息 —— assistant 被孤立
	if (
		hasToolCalls(messages[endIndex - 1]) &&
		messages[endIndex]?.role !== "tool"
	) {
		// 把这条 assistant 也纳入保留部分
		endIndex--;
	}

	// 情况 2：保留部分的第一条是 tool 消息，
	// 但被切掉部分的最后一条不是对应的 assistant(tool_calls) -- tool 被孤立
	// 注意：assistant 一次发起多个 tool_calls 时会连续产生多条 tool 响应，
	// 若切点落在这一组中间，会同时孤立多条 tool，单次 if 无法处理，必须用 while
	while (
		messages[endIndex]?.role === "tool" &&
		!hasToolCalls(messages[endIndex - 1])
	) {
		// 把切点后移，使这条 tool 推入被切掉一侧，与前序消息一起被总结/删除
		endIndex++;
	}

	return endIndex;
};

const softDeleteToolResults = (messages: AI.Message[]) => {
	const deletedCount = messages.reduce((result, message) => {
		if (message.role === "tool") {
			message.content = "（工具调用结果被压缩）";
			result++;
		}
		return result;
	}, 0);

	if (deletedCount > 0) {
		logger(`软删除了${deletedCount}条工具调用结果消息`);
	}
};

const softDeleteOldMediaMessages = (messages: AI.Message[]) => {
	const mediaTypes = ["image_url", "input_audio", "video_url"];

	const deletedCount = messages.reduce((result, message) => {
		if (
			Array.isArray(message.content) &&
			message.content.some((part) => mediaTypes.includes(part.type))
		) {
			message.content = "（多模态消息被压缩）";
			result++;
		}
		return result;
	}, 0);

	if (deletedCount > 0) {
		logger(`软删除了${deletedCount}条旧图片/音频/视频消息`);
	}
};

const summarizeMessages = async (messages: AI.Message[]) => {
	// 从第一条用户消息开始总结
	const startIndex = messages.findIndex((message) => message.role === "user");
	// 保留最近的消息
	const keepRecentCount = Math.ceil(messages.length * 0.2);
	let endIndex = messages.length - keepRecentCount;

	// 消息太少时不需要总结
	if (endIndex <= startIndex) {
		logger("消息太少，无需总结");
		return false;
	}

	// 对齐配对组边界，避免拆散 assistant(tool_calls) + tool
	endIndex = alignToolGroupBoundary(messages, endIndex);

	const summarizingMessages = messages.slice(startIndex, endIndex);
	summarizingMessages.push(
		contentToMessage(SUMMARIZE_PROMPT, { role: "system" }),
		contentToMessage("开始总结上下文", { role: "user" }),
	);

	const [error, summarized] = await to(
		generateContent(summarizingMessages, {
			// 如果有工具，则临时移除，让模型专注于总结消息
			extraBody: { tools: [] },
		}),
	);
	if (error) {
		logger(`总结失败：${error.message}`);
		return false;
	}

	// 替换原始消息数组中被总结的消息
	messages.splice(
		startIndex,
		endIndex - startIndex,
		contentToMessage(`# 消息摘要\n${summarized.content}`),
	);
};

const hardDeleteOldMessages = (messages: AI.Message[]) => {
	// 从第一条user消息开始
	const startIndex = messages.findIndex((message) => message.role === "user");
	// 保留最近的消息
	const keepRecentCount = Math.ceil(messages.length * 0.1);
	let endIndex = messages.length - keepRecentCount;

	// 消息太少，没有可删除的余量
	if (endIndex <= startIndex) {
		logger("消息太少，无需硬删除");
		return;
	}

	// 对齐配对组边界，避免拆散assistant(tool_calls) + tool
	endIndex = alignToolGroupBoundary(messages, endIndex);

	const deletedCount = endIndex - startIndex;
	messages.splice(startIndex, deletedCount);
	logger(`硬删除了${deletedCount}条较早的消息`);
};

/**
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
const compactMessages = async (
	messages: AI.Message[],
	options?: {
		/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值 */
		usage?: ChatCompletions.Usage;
	},
) => {
	const { usage } = options ?? {};
	const tokens = usage?.total_tokens ?? estimateTokens(messages);
	const context = modelRef.current.context ?? 128000;

	// 上下文 > 总上下文*60% => 压缩工具调用结果
	if (tokens > context * config.etc.compactToolResultRatio) {
		softDeleteToolResults(messages);
	}

	// 上下文 > 总上下文*70% => 压缩图片/音频/视频消息
	if (tokens > context * config.etc.compactAssetRatio) {
		softDeleteOldMediaMessages(messages);
	}

	// 上下文 > 总上下文*80% => 总结消息
	if (tokens > context * config.etc.compactRatio) {
		const [error] = await to(summarizeMessages(messages));
		if (!error) {
			// summarize已经总结足够多的消息，无需兜底
			return;
		}

		// 作为兜底，硬删除较早的消息
		hardDeleteOldMessages(messages);
	}
};

export default compactMessages;
