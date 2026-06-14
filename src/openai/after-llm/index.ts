import type { ChatCompletions } from "@nickyzj2023/utils";
import config from "@/config.js";
import type { GroupMessageEvent } from "@/onebot/schemas/http-post.js";
import { removeMostImages, summarizeMessages } from "../utils/optimizations.js";

/**
 * 调用大模型之后的生命周期，用于优化消息上下文
 */
export const afterLLM = async (
	e: GroupMessageEvent,
	messages: ChatCompletions.Message[],
	info?: {
		isTokenNearLimit?: boolean;
	},
) => {
	// 消息超过上下文长度时，先缩减大小
	if (info?.isTokenNearLimit) {
		removeMostImages(messages);
	}

	// 消息超过一定数量时，调用模型总结一部分
	if (messages.length > config.etc.summarizeThreshold) {
		await summarizeMessages(messages);
	}
};
