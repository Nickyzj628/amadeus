import { type AI, LockQueue, logger } from "@nickyzj2023/utils";
import { loadJSON, saveJSON } from "@/common/db.js";
import config from "@/config.js";
import { SYSTEM_PROMPT } from "./constants.js";

const groupMessagesMap = new Map<number, AI.Message[]>();
const groupQueueMap = new Map<number, LockQueue>();

/** 根据群号读取消息数组 */
export const loadMessages = async (groupId: number) => {
	// 如果在内存里，则直接返回
	if (groupMessagesMap.has(groupId)) {
		return {
			messages: groupMessagesMap.get(groupId)!,
			queue: groupQueueMap.get(groupId)!,
		};
	}

	// 从本地读取群消息
	const messages = await loadJSON<AI.Message[]>(`/data/${groupId}.json`, {
		fallbackData: [],
	});
	// 刷新系统提示词
	messages[0] = {
		role: "system",
		content: SYSTEM_PROMPT,
	};
	// 常驻内存
	groupMessagesMap.set(groupId, messages);

	// 读取群聊排队锁
	const queue = groupQueueMap.getOrInsert(groupId, new LockQueue());

	// 释放内存中不活跃的群消息
	if (groupMessagesMap.size > config.etc.maxActiveGroupCount) {
		for (const [groupId, messages] of groupMessagesMap) {
			if (groupQueueMap.has(groupId)) {
				continue;
			}
			saveJSON(`/data/${groupId}.json`, messages)
				.then(() => {
					groupMessagesMap.delete(groupId);
					logger(`已释放内存中不活跃的群消息：${groupId}`);
				})
				.catch((e) => {
					logger(`未能释放内存中的群消息：${e.message}`);
				});
		}
	}

	return { messages, queue };
};

/**
 * 根据群号保存消息数组
 * @remarks 如果传参有缺省，则把内存中的所有消息保存到本地
 */
export const saveMessages = async (
	groupId?: number,
	messages?: AI.Message[],
) => {
	// 如果省略 groupId，则视为保存所有群的消息
	if (!groupId) {
		for (const [groupId, messages] of groupMessagesMap) {
			await saveMessages(groupId, messages);
		}
		return;
	}

	await saveJSON(
		`/data/${groupId}.json`,
		messages ?? groupMessagesMap.get(groupId),
	);
};
