// --- OpenAI API 消息相关工具 ---

import { timeLog, to } from "@nickyzj2023/utils";
import ai from "../handlers/non-commands/ai";
import type { GroupMessageEvent } from "../schemas/onebot/http-post";
import type { ChatCompletionInputMessage } from "../schemas/openai";
import {
	flattenForwardSegment,
	isAtSegment,
	isAtSelfSegment,
	isForwardSegment,
	isImageSegment,
	isTextSegment,
} from "./onebot";

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
 */
export const onebotToOpenai = async (
	e: GroupMessageEvent,
	options?: {
		/** 是否使用视觉模型，把图片翻译为自然语言 */
		enableImageUnderstanding: boolean;
	},
) => {
	const messages: ChatCompletionInputMessage[] = [];
	const identity = `${e.sender.nickname}(@${e.sender.user_id})`;

	let prefix = "";
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			const text = `${identity}：${prefix}${segment.data.text.trim()}`;
			messages.push(textToMessage(text));
		}
		// 图片
		else if (isImageSegment(segment) && options?.enableImageUnderstanding) {
			const [error, imageDesc] = await to(ai.imageToText(segment.data));
			if (error) {
				throw new Error(error.message);
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
				processMessage: (message) => {
					const identity = `${message.sender.nickname}(@${message.sender.user_id})`;
					const text = `${identity}：${message.segment.data.text.trim()}`;
					return textToMessage(text, {
						role: isAtSelfSegment(segment, e) ? "assistant" : "user",
					});
				},
			});
			messages.push(...forwaredMessages);
		}
	}

	return messages;
};
