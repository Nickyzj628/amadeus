import { LockQueue, log } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SYSTEM_PROMPT } from "@/constants.js";
import type { Message } from "@/schemas/openai/index.js";
import { loadJSON, saveJSON } from "@/utils/common.js";

const groupMessagesMap = new Map<number, Message[]>();
const groupQueueMap = new Map<number, LockQueue>();

/** 根据群号读取消息数组 */
export const loadGroupMessages = async (
	groupId: number,
	options?: {
		/**
		 * 是否在每次读取群消息进内存时，重置消息里的系统提示词
		 * @default true
		 */
		resetSystemPromptWhenLoad?: boolean;
	},
) => {
	const { resetSystemPromptWhenLoad = true } = options ?? {};

	// 如果内存中有该群的消息，则直接返回
	if (groupMessagesMap.has(groupId)) {
		return {
			messages: groupMessagesMap.get(groupId)!,
			queue: groupQueueMap.get(groupId)!,
		};
	}

	// 从文件读取群消息
	const messages = await loadJSON<Message[]>(`/data/${groupId}.json`, {
		createWithDataIfNotExist: [],
	});

	// 创建排队锁
	if (!groupQueueMap.has(groupId)) {
		groupQueueMap.set(groupId, new LockQueue());
	}
	const queue = groupQueueMap.get(groupId)!;

	// 重置系统提示词
	if (resetSystemPromptWhenLoad || messages.length === 0) {
		messages[0] = {
			role: "system",
			content: SYSTEM_PROMPT,
		};
	}

	// 加入活跃群聊 Map
	groupMessagesMap.set(groupId, messages);

	// 释放不活跃的群聊内存
	if (groupMessagesMap.size > config.etc.maxActiveGroupCount) {
		for (const [groupId, messages] of groupMessagesMap) {
			if (groupQueueMap.has(groupId)) {
				continue;
			}
			saveJSON(`/data/${groupId}.json`, messages)
				.then(() => {
					groupMessagesMap.delete(groupId);
					log(`释放了${groupId}的消息内存`);
				})
				.catch((e) => {
					log(`释放${groupId}的消息内存失败：${e.message}`);
				});
		}
	}

	return { messages, queue };
};

/** 根据群号保存消息数组 */
export const saveGroupMessages = async (
	groupId: number,
	messages: Message[],
) => {
	await saveJSON(`/data/${groupId}.json`, messages);
};
