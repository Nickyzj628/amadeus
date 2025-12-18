// --- 数据库相关工具 ---

import { Ai } from "../handlers/plain-text";
import type { GroupMessageEvent } from "../schemas/onebot/http-post";
import type { ChatCompletionMessage } from "../schemas/openai";
import { makeChatCompletionMessage } from "./chat";
import {
	getForwardMessage,
	isAtSelfSegment,
	isForwardSegment,
	isTextSegment,
} from "./segment";

/**
 * 记录群友聊天消息，可用于“/总结一下”
 * 会把消息格式从 OneBot 转成 OpenAI API
 */
export const saveGroupMessage = async (e: GroupMessageEvent) => {
	// 根据群号读取消息数组
	const groupFullMessages = readGroupFullMessages(e.group_id);

	// --- 根据消息类型提取内容 ---
	let messages: ChatCompletionMessage[] = [];
	const role = "user";
	const name = `${e.sender.nickname}（${e.sender.user_id}）`;

	// 纯文本
	const textSegment = isTextSegment(e);
	if (textSegment) {
		messages[0] = makeChatCompletionMessage(role, name, textSegment.data.text);
	}
	// @+纯文本
	else {
		const atSegment = isAtSelfSegment(e);
		const textSegment2 = isTextSegment(e, 1);
		if (atSegment && textSegment2) {
			messages[0] = {
				role,
				name,
				content: `@${atSegment.data.qq} ${textSegment2.data.text}`,
			};
		}
		// 合并转发
		else {
			const forwardSegment = isForwardSegment(e);
			if (forwardSegment) {
				messages = await getForwardMessage(forwardSegment.data.id);
			}
		}
	}

	groupFullMessages.push(...messages);
};

/** 根据群号读取消息数组 */
export const readGroupFullMessages = async (groupId: number) => {
	if (!Array.isArray(Ai.groupFullMessagesMap[groupId])) {
		Ai.groupFullMessagesMap[groupId] = [];
	}
	return Ai.groupFullMessagesMap[groupId];
};
