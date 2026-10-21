import { type Message, runAgent, type Usage } from "@nickyzj2023/ai";
import {
	compactStr,
	createXMLText,
	extractXmlTagContent,
	hasXmlTag,
	logger,
} from "@nickyzj2023/utils";
import { loadJSON, saveJSON } from "@/common/db.js";
import { generateUUID } from "@/common/util.js";
import config from "@/config.js";
import deleteMemoryTool from "../tools/delete-memory.js";
import saveMemoryTool from "../tools/save-memory.js";
import skipReply from "../tools/skip-reply.js";
import { COLLECT_MEMORIES_PROMPT } from "./constants.js";
import { contentToMessage } from "./convert.js";
import { modelRef } from "./model.js";

// { id1: "24岁", id2: "是学生" }
type UserMemory = Record<string, string>;

// { A: { id1: "24岁", id2: "是学生" }, B: {...} }
type UsersMemory = Record<string, UserMemory>;

/**
 * 使用UsersMemory构造一条<memory>消息
 * @returns `{ role: "user", content: "<memory>\n{serialized}\n</memory>" }`
 */
export const buildMemoryMessage = (usersMemory: UsersMemory) => {
	const serialized =
		Object.entries(usersMemory)
			.map(([userId, userMemory]) => {
				return `# ${userId}\n${Object.entries(userMemory)
					.map(([id, content]) => `- ${id}: ${content}`)
					.join("\n")}`;
			})
			.join("\n\n") || "（暂无相关记忆）";
	return contentToMessage(createXMLText("memory", serialized));
};

// ================================
// CRUD
// ================================

/**
 * 从本地/data/user/{userId}.json读取用户记忆
 * @returns 文件存在时返回UserMemory
 * @returns 文件不存在时返回{}
 */
export const loadMemory = async (userId: number) => {
	const um = await loadJSON<UserMemory>(`/data/user/${userId}.json`);
	return um ?? {};
};

/**
 * create/update一段记忆
 * @param text 记忆内容
 * @param userId 用户QQ号
 * @param memoryId 记忆UUID，不传就是创建，传了就是更新
 * @remarks 如果超出预算（1375字符），会抛异常
 */
export const saveMemory = async (
	text: string,
	userId: number,
	memoryId?: string,
) => {
	const memory = await loadMemory(userId);
	if (!memoryId) {
		memory[generateUUID()] = text;
	} else {
		memory[memoryId] = text;
	}

	// 记忆容量检测
	const memoryWords = Object.values(memory).reduce(
		(acc, value) => acc + value.length,
		0,
	);
	if (memoryWords > config.etc.perUserMemoryBudget) {
		throw new Error(
			`用户${userId}的记忆容量超出上限（${memoryWords}/${config.etc.perUserMemoryBudget}字符），请考虑删减过时的记忆（<memory>标签内的信息是按时间顺序存储的）`,
		);
	}

	await saveJSON(`/data/user/${userId}.json`, memory);
};

/**
 * 删除一份记忆
 * @param userId 用户QQ号
 * @param memoryId 记忆UUID
 */
export const deleteMemory = async (userId: number, memoryId: string) => {
	const um = await loadMemory(userId);
	delete um[memoryId];
	await saveJSON(`/data/user/${userId}.json`, um);
};

// ================================
// 注入记忆
// ================================

/**
 * 给上下文底部注入一条<memory>消息
 * @param messages 上下文，会在底部注入role=user content=<memory>的临时消息
 * @param userId QQ号，支持数组
 * @param query 要搜索的记忆内容（还未实现，以后手写BM25）
 * @remarks 不抛异常；即使搜索失败也会注入占位记忆，保证模型始终能看到<memory>消息
 */
export const injectMemory = async (
	messages: Message[],
	userId: number | number[],
) => {
	const usersMemory: UsersMemory = {};

	const userIds = Array.isArray(userId) ? userId : [userId];
	for (const userId of userIds) {
		const um = await loadMemory(userId);
		if (Object.keys(um).length > 0) {
			usersMemory[userId] = um;
		}
	}

	const message = buildMemoryMessage(usersMemory);
	messages.push(message);
	logger(
		`注入记忆：\n${compactStr(message.content as string, { maxLength: 100, truncateMiddle: true })}`,
	);
};

/**
 * 收回本轮注入的<memory>消息
 * 模型处理失败（index.ts的catch块）时调用，把injectMemory注入的记忆移除
 */
export const deleteInjectedMemory = (messages: Message[]) => {
	const index = messages.findLastIndex(
		(message) =>
			typeof message.content === "string" && hasXmlTag(message.content, "memory"),
	);
	if (index !== -1) {
		messages.splice(index, 1);
	}
};

// ================================
// 采集+整理记忆
// ================================

/**
 * 从即将被总结的消息中，采集值得保存的记忆点
 * 相当于让模型把这些消息当一轮对话读一遍，自主决定新增/更新/删除哪些记忆
 * @param dyingMessages 待总结的消息（压缩后原文会被丢弃），只读不改
 * @remarks 不抛异常；采集失败只记日志，不影响调用方继续压缩上下文
 */
export const collectMemories = async (dyingMessages: Message[]) => {
	// 提取纯文本的user/assistant消息
	const collectable = dyingMessages.filter(
		(message) =>
			typeof message.content === "string" &&
			(message.role === "user" || message.role === "assistant") &&
			!message.tool_calls,
	);
	if (!collectable.length) return;

	// 统计消息中出现过的QQ号
	const userIds = new Set<number>();
	for (const message of collectable) {
		const userId = extractXmlTagContent(message.content as string, "user_id");
		if (userId) {
			// "\n1927139831\n" => 1927139831
			userIds.add(Number(userId.replaceAll("\n", "")));
		}
	}
	if (!userIds.size) return;

	// 上下文 = 系统提示词 + 便于采集记忆的历史消息
	const wipMessages: Message[] = [
		{ role: "system", content: COLLECT_MEMORIES_PROMPT },
		...collectable,
	];

	// + 用户已有记忆
	const usersMemory: UsersMemory = {};
	for (const userId of userIds) {
		const memory = await loadMemory(userId);
		if (Object.keys(memory).length > 0) {
			usersMemory[userId] = memory;
		}
	}
	wipMessages.push(buildMemoryMessage(usersMemory));

	// + 用户指令
	const instructionMessage: Message = {
		role: "user",
		content: createXMLText(
			"system-reminder",
			"请根据系统提示词，开始记忆采集任务",
		),
	};
	wipMessages.push(instructionMessage);

	// 交给大模型整理
	let usage: Usage | undefined;
	try {
		for await (const e of runAgent(modelRef.current, wipMessages, [
			saveMemoryTool,
			deleteMemoryTool,
			skipReply, // 它会抛异常，所以包一层try-catch
		])) {
			switch (e.type) {
				case "tool_call":
					logger(`采集记忆-调用工具${e.name}`, e.args);
					break;
				case "tool_result":
					logger(`采集记忆-工具结果：${e.name}`, e.result);
					break;
				case "done":
					usage = e.usage;
					break;
				case "error":
					logger(`采集记忆失败：${e.message}`);
					return;
			}
		}
		usage && logger("采集记忆消耗：", usage, "\n");
	} catch {}
};
