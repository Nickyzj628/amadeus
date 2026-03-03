import { log } from "@nickyzj2023/utils";
import type { ChatCompletionMessageParam } from "openai/resources";

type PruneMessagesOptions = {
	/**
	 * 消息占用多少内存才执行修剪（字节），默认 10MB
	 * @default 10 * 1024 * 1024
	 */
	maxBytes?: number;
};

/** 估算消息数组占用的内存大小（字节） */
const estimateMessagesSize = (
	messages: ChatCompletionMessageParam[],
): number => {
	return JSON.stringify(messages).length * 2; // UTF-16 编码，每个字符 2 字节
};

/** 移除消息中的图片，只保留最后一张 */
const removeMostImages = (messages: ChatCompletionMessageParam[]) => {
	// 收集所有包含图片的消息
	const imageMessages: ChatCompletionMessageParam[] = [];
	for (const message of messages) {
		if (
			message &&
			Array.isArray(message.content) &&
			message.content.some((part: any) => part.type === "image")
		) {
			imageMessages.push(message);
		}
	}

	// 如果没有图片或只有一张，不做处理
	if (imageMessages.length <= 1) {
		return;
	}

	// 保留最后一张图片，移除其他所有图片
	// 倒序遍历避免索引错乱
	const lastImage = imageMessages.at(-1);
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message && imageMessages.includes(message) && message !== lastImage) {
			messages.splice(i, 1);
		}
	}

	log(`已移除${imageMessages.length - 1}张图片，保留最后1张`);
};

/**
 * 修剪消息数组，使用以下方式控制内存大小：
 * 1. 移除多余的图片
 * @param messages 消息数组，会被本函数修改
 * @param options 配置选项
 */
export const pruneMessages = async (
	messages: ChatCompletionMessageParam[],
	options: PruneMessagesOptions = {},
) => {
	const { maxBytes = 10 * 1024 * 1024 } = options;
	const estimatedSize = estimateMessagesSize(messages);
	if (estimatedSize > maxBytes) {
		log("消息占用内存超过阈值，开始修剪");
		removeMostImages(messages);
	}
};
