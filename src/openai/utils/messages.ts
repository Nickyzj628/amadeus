import type { Message } from "@nickyzj2023/ai";
import { createXMLText, logger } from "@nickyzj2023/utils";
import { loadJSON, saveJSON } from "@/common/db.js";
import config from "@/config.js";
import { SYSTEM_PROMPT } from "./constants.js";
import { modelRef } from "./model.js";

const groupMessagesMap = new Map<number, Message[]>();

/** 根据群号读取消息数组 */
export const loadMessages = async (
	groupId: number,
	options?: {
		/** 本地不存在此群消息时的回调，默认写入一条系统提示词 */
		whenEmpty?: () => Message[];
		/** 从本地硬盘载入时的回调，默认刷新系统提示词 + 追加一条当前模型名称的system-reminder */
		whenLoadFromLocal?: (messages: Message[]) => void;
	},
) => {
	const {
		whenEmpty = () => [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
		],
		whenLoadFromLocal = (messages: Message[]) => {
			messages[0]!.content = SYSTEM_PROMPT;
			messages.push({
				role: "user",
				content: createXMLText(
					"system-reminder",
					`当前使用的模型：${modelRef.current.model ?? config.models[0]?.model ?? "未知"}`,
				),
			});
		},
	} = options ?? {};

	// 如果在内存里，则直接返回
	let messages = groupMessagesMap.get(groupId);
	if (messages) {
		return messages;
	}

	// 从本地读取群消息
	let localMessages = await loadJSON<Message[]>(`/data/${groupId}.json`);
	if (!localMessages) {
		localMessages = whenEmpty();
	}
	whenLoadFromLocal(localMessages);

	// 常驻内存
	groupMessagesMap.set(groupId, localMessages);
	messages = localMessages;

	// 释放内存中不活跃的群消息
	if (groupMessagesMap.size > config.etc.maxActiveGroupCount) {
		for (const [id, messages] of groupMessagesMap) {
			// 不释放当前群、因为刚载入内存，马上要处理
			if (id === groupId) {
				continue;
			}

			// 不释放正在处理的群
			const isIdle = await navigator.locks.request(
				`group-${id}`,
				{ ifAvailable: true }, // 如果当前正在占用队列，会传递null给下面的回调
				(lock) => lock !== null, // 队列空闲 => true
			);
			if (!isIdle) {
				continue;
			}

			// 静默写回本地 + 释放群消息
			saveJSON(`/data/${id}.json`, messages)
				.then(() => {
					groupMessagesMap.delete(id);
					logger(`已释放不活跃的群消息：${id}`);
				})
				.catch((e) => {
					logger(`未能释放群消息：${e.message}`);
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
