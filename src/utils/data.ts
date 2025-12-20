// --- 数据库相关工具 ---

import { timeLog } from "@nickyzj2023/utils";
import ai from "../handlers/plain-texts/ai";
import type { GroupMessageEvent } from "../schemas/onebot/http-post";
import type { ChatCompletionMessage } from "../schemas/openai";
import {
	flattenForwardSegment,
	isAtSegment,
	isAtSelfSegment,
	isForwardSegment,
	isTextSegment,
} from "./onebot";
import { textToMessage } from "./openai";

/**
 * 记录群友聊天消息，可用于“/总结一下”
 *
 * @remarks
 * 会把消息格式从 OneBot 转成 OpenAI API 后放入数据库
 */
export const saveGroupMessage = async (e: GroupMessageEvent) => {
	// 根据群号读取消息数组
	const groupId = e.group_id;
	const groupFullMessages = readGroupFullMessages(groupId);

	// --- 根据消息类型提取内容 ---
	const messages: ChatCompletionMessage[] = [];
	const name = `${e.sender.nickname}（${e.sender.user_id}）`;
	const [segment, segment2] = e.message;

	// 纯文本
	if (isTextSegment(segment)) {
		messages[0] = textToMessage(segment.data.text, { name });
	}
	// @+纯文本
	else {
		if (isAtSegment(segment) && isTextSegment(segment2)) {
			messages[0] = textToMessage(`@${segment.data.qq} ${segment2.data.text}`, {
				name,
			});
		}
		// 合并转发
		else {
			if (isForwardSegment(segment)) {
				const forwaredMessages = await flattenForwardSegment(segment.data.id, {
					processMessage: (message) => {
						const text = message.segment.data.text.trim();
						const name = `${message.sender.nickname}（${message.sender.user_id}）`;
						return textToMessage(text, {
							role: isAtSelfSegment(segment, e) ? "assistant" : "user",
							name,
						});
					},
				});
				messages.push(...forwaredMessages);
			}
		}
	}

	groupFullMessages.push(...messages);
	timeLog(
		`群号${groupId}共存放${groupFullMessages.length}条消息，新存放的消息如下`,
		JSON.stringify(messages, null, 2),
	);
};

/** 根据群号读取消息数组 */
export const readGroupFullMessages = (groupId: number) => {
	if (!Array.isArray(ai.groupFullMessagesMap[groupId])) {
		ai.groupFullMessagesMap[groupId] = [];
	}
	return ai.groupFullMessagesMap[groupId];
};
