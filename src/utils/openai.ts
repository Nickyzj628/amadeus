import { timeLog, to } from "@nickyzj2023/utils";
import { imageToText } from "@/handlers/non-commands/ai/utils";
import type { MinimalMessageEvent } from "@/schemas/onebot/http-post";
import type { ChatCompletionInputMessage } from "@/schemas/openai";
import {
	flattenForwardSegment,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isTextSegment,
} from "./onebot";

/** 和机器人相关的消息列表，按群号划分，准备放入 sqlite */
export const groupMessagesMap = new Map<number, ChatCompletionInputMessage[]>();

/**
 * 根据群号读取消息数组（仅和机器人相关的）
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = (
	groupId: number,
	initialMessages: ChatCompletionInputMessage[] = [],
) => {
	const messages = groupMessagesMap.get(groupId);
	if (!Array.isArray(messages) || messages.length === 0) {
		groupMessagesMap.set(groupId, initialMessages);
		return initialMessages;
	}
	return messages;
};

/** 构造 OpenAI API 消息对象 */
export const textToMessage = (
	text: string,
	args?: Partial<Omit<ChatCompletionInputMessage, "content">>,
) => {
	const message: ChatCompletionInputMessage = {
		role: args?.role ?? "user",
		content: text,
	};
	return message;
};

/**
 * 把消息格式从 OneBot 转成 OpenAI API
 *
 * @remarks
 * 保证安全返回数组
 */
export const onebotToOpenai = async (
	e: MinimalMessageEvent,
	options?: {
		/** 是否调用视觉模型，把图片翻译为自然语言 */
		enableImageUnderstanding?: boolean;
		/** 每条转发消息允许递归获取的消息数 */
		forwardCount?: number;
	},
) => {
	const messages: ChatCompletionInputMessage[] = [];
	const identity = `${e.sender.nickname}(@${e.sender.user_id})`;

	let prefix = "";
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			const text = `${identity}：${prefix}${segment.data.text}`;
			messages.push(textToMessage(text));
		}
		// 图片
		else if (isImageSegment(segment) && options?.enableImageUnderstanding) {
			const [error, imageDesc] = await to(imageToText(segment.data));
			if (error) {
				timeLog(`图片识别失败：${error.message}`);
			}
			messages.push(
				textToMessage(`${identity}：${prefix}【IMAGE_PARSED】${imageDesc}`),
			);
			timeLog(`识别了一张图片：${imageDesc}`);
		}
		// @某人
		else if (isAtSegment(segment)) {
			prefix += `@${segment.data.qq} `;
		}
		// 合并转发
		else if (isForwardSegment(segment)) {
			const forwaredMessages = await flattenForwardSegment(segment.data.id, {
				count: options?.forwardCount,
				processMessageEvent: async (e) => {
					return await onebotToOpenai(e);
				},
			});
			messages.push(...forwaredMessages);
		}
	}

	return messages;
};
