// --- 数据库相关工具 ---

import { timeLog } from "@nickyzj2023/utils";
import type { GroupMessageEvent } from "../schemas/onebot/http-post";
import type { ChatCompletionMessage } from "../schemas/openai";
import { onebotToOpenai } from "./openai";

/** 消息列表，按群号划分，后期放到 sqlite 数据表里 */
export const groupFullMessagesMap = new Map<number, ChatCompletionMessage[]>();

/** 和机器人相关的消息列表，按群号划分 */
export const groupMessagesMap = new Map<number, ChatCompletionMessage[]>();

/**
 * 记录群友聊天消息，可用于“/总结一下”
 *
 * @remarks
 * 会把消息格式从 OneBot 转成 OpenAI API 后放入数据库
 */
export const saveGroupMessage = async (e: GroupMessageEvent) => {
	// 根据群号读取消息数组
	const groupId = e.group_id;
	const groupFullMessages = await readGroupFullMessages(groupId);

	// 转换消息为 OpenAI API 支持的格式
	const messages = await onebotToOpenai(e);

	groupFullMessages.push(...messages);
	timeLog(
		`群号${groupId}共存放${groupFullMessages.length}条消息，新存放的消息如下`,
		JSON.stringify(messages, null, 2),
	);
	return messages;
};

/**
 * 获取群历史消息
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupFullMessages = async (
	groupId: number,
	initialMessages: ChatCompletionMessage[] = [],
) => {
	const messages = groupFullMessagesMap.get(groupId);
	if (!Array.isArray(messages)) {
		groupFullMessagesMap.set(groupId, initialMessages);
		return initialMessages;
	}
	return messages;
};

/**
 * 根据群号读取消息数组（仅和机器人相关的）
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = (
	groupId: number,
	initialMessages: ChatCompletionMessage[] = [],
) => {
	const messages = groupMessagesMap.get(groupId);
	if (!Array.isArray(messages) || messages.length === 0) {
		groupMessagesMap.set(groupId, initialMessages);
		return initialMessages;
	}
	return messages;
};
