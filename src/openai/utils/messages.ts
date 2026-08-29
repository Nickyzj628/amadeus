import type { Message } from "@nickyzj2023/ai";
import { logger } from "@nickyzj2023/utils";
import { loadJSON, saveJSON } from "@/common/db.js";
import config from "@/config.js";
import { SYSTEM_PROMPT } from "./constants.js";

const groupMessagesMap = new Map<number, Message[]>();

/** 根据群号读取消息数组 */
export const loadMessages = async (groupId: number) => {
	// 如果在内存里，则直接返回
	if (groupMessagesMap.has(groupId)) {
		return groupMessagesMap.get(groupId)!;
	}

	// 从本地读取群消息
	const messages = await loadJSON<Message[]>(`/data/${groupId}.json`, {
		fallbackData: [],
	});
	// 刷新系统提示词
	messages[0] = {
		role: "system",
		content: SYSTEM_PROMPT,
	};
	// 常驻内存
	groupMessagesMap.set(groupId, messages);

	// 释放内存中不活跃的群消息
	if (groupMessagesMap.size > config.etc.maxActiveGroupCount) {
		for (const [otherGroupId, messages] of groupMessagesMap) {
			// 当前群刚加载进内存、马上要处理消息，跳过不释放
			if (otherGroupId === groupId) {
				continue;
			}
			// 用 Web Locks 的 ifAvailable 探测该群是否空闲（没有排队/正在处理的消息请求）：
			// 能立即拿到锁说明空闲，空闲且超量的群才释放。
			// 锁名格式必须与 index.ts 请求锁时保持一致（`group-${groupId}`）
			const isIdle = await navigator.locks.request(
				`group-${otherGroupId}`,
				{ ifAvailable: true },
				(lock) => lock !== null,
			);
			if (!isIdle) {
				continue;
			}
			saveJSON(`/data/${otherGroupId}.json`, messages)
				.then(() => {
					groupMessagesMap.delete(otherGroupId);
					logger(`已释放内存中不活跃的群消息：${otherGroupId}`);
				})
				.catch((e) => {
					logger(`未能释放内存中的群消息：${e.message}`);
				});
		}
	}

	return messages;
};

/**
 * 根据群号保存消息数组
 * @remarks 如果传参有缺省，则把内存中的所有消息保存到本地
 */
export const saveMessages = async (groupId?: number, messages?: Message[]) => {
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
