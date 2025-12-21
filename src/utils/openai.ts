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
 *
 * @remarks
 * 保证返回的是 Promise<ChatCompletionMessage[]>，不会向外抛出错误
 */
export const onebotToOpenai = async (e: GroupMessageEvent) => {
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
		else if (isImageSegment(segment)) {
			const [error, imageDesc] = await to(ai.imageToText(segment.data));
			if (error) {
				timeLog(`识别图片失败：${error.message}`);
				continue;
			}
			messages.push(
				textToMessage(`${identity}：${prefix}【IMAGE_PARSED】${imageDesc}`),
			);
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
