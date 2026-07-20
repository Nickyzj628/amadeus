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

/**
 * 根据上下文里的中/英文，估算出可能消耗的token
 */
export const estimateTokens = (messages?: AI.Message[]) => {
	if (!messages?.length) {
		return 0;
	}

	let tokens = 0;

	const estimateTextTokens = (text: string) => {
		// 匹配中文、日文和韩文等 CJK 字符，并统计它们在文本中的数量。
		const cjkCharacters =
			text.match(/[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
		// 这是粗略估算：每个 CJK 字符按约 1.5 个 token 计算；剩余字符（英文、数字、标点等）每 4 个按约 1 个 token 计算。
		// 最后向上取整，避免不足 1 个 token 的少量字符被估算为 0。
		return Math.ceil(cjkCharacters * 1.5 + (text.length - cjkCharacters) / 4);
	};

	for (const message of messages) {
		const { content, tool_calls, ...metadata } = message;

		if (typeof content === "string") {
			tokens += estimateTextTokens(content);
		} else {
			for (const part of content) {
				if (part.type === "text") {
					tokens += estimateTextTokens(part.text);
				} else {
					// 不计算 URL/base64 数据：其大小与视觉上下文的 token 消耗无关。
					tokens += 10000;
				}
			}
		}

		if (tool_calls) {
			tokens += estimateTextTokens(JSON.stringify(tool_calls));
		}
		tokens += estimateTextTokens(JSON.stringify(metadata));
	}

	return tokens;
};
