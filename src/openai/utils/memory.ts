import { type Message, runAgent, type Usage } from "@nickyzj2023/ai";
import {
	createXMLText,
	extractErrorMessage,
	extractXmlTagContent,
	hasXmlTag,
	logger,
} from "@nickyzj2023/utils";
import { loadJSON, saveJSON } from "@/common/db.js";
import { generateUUID } from "@/common/util.js";
import forgetMemoryTool from "../tools/deleteMemory.js";
import saveMemoryTool from "../tools/saveMemory.js";
import skipReply from "../tools/skipReply.js";
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
	logger(`注入记忆：\n${serialized}`);
	return contentToMessage(createXMLText("memory", serialized));
};

// ================================
// CRUD
// ================================

/**
 * 从本地/data/{userId}.json读取用户记忆
 * @returns 文件存在时返回UserMemory
 * @returns 文件不存在时返回{}
 */
export const loadMemory = async (userId: number) => {
	const um = await loadJSON<UserMemory>(`/data/${userId}.json`);
	return um ?? {};
};

/**
 * create/update一段记忆
 * @param text 记忆内容
 * @param userId 用户QQ号
 * @param memoryId 记忆UUID，不传就是创建，传了就是更新
 * @remarks 即使保存失败，也不会抛异常
 */
export const saveMemory = async (
	text: string,
	userId: number,
	memoryId?: string,
) => {
	try {
		const um = await loadMemory(userId);
		if (!memoryId) {
			um[generateUUID()] = text;
		} else {
			um[memoryId] = text;
		}
		await saveJSON(`/data/${userId}.json`, um);
	} catch (e) {
		logger(`记忆保存失败：${extractErrorMessage(e)}`);
	}
};

/**
 * 删除一份记忆
 * @param userId 用户QQ号
 * @param memoryId 记忆UUID
 */
export const deleteMemory = async (userId: number, memoryId: string) => {
	const um = await loadMemory(userId);
	delete um[memoryId];
	await saveJSON(`/data/${userId}.json`, um);
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
	messages.push(buildMemoryMessage(usersMemory));
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
	// 只把纯文本的user/assistant消息交给模型
	const collectable = dyingMessages.filter((message) => {
		return (
			typeof message.content === "string" &&
			(message.role === "user" || message.role === "assistant") &&
			!message.tool_calls
		);
	});
	if (!collectable.length) {
		return;
	}

	// 统计消息中出现过的QQ号
	const userIds = new Set<number>();
	for (const message of collectable) {
		const userId = extractXmlTagContent(message.content as string, "user_id");
		if (userId) {
			userIds.add(Number(userId.replaceAll("\n", "")));
		}
	}
	if (!userIds.size) {
		return;
	}

	// 准备上下文：系统提示词+便于采集记忆的历史消息+用户指令
	const workingMessages: Message[] = [
		{ role: "system", content: COLLECT_MEMORIES_PROMPT },
		...collectable,
	];

	// +已有记忆
	const usersMemory: UsersMemory = {};
	for (const userId of userIds) {
		const um = await loadMemory(userId);
		if (Object.keys(um).length > 0) {
			usersMemory[userId] = um;
		}
	}

	// +用户指令
	const instructionMessage: Message = {
		role: "user",
		content: createXMLText("system-reminder", "请根据系统提示词，执行本次任务"),
	};
	workingMessages.push(buildMemoryMessage(usersMemory), instructionMessage);

	// 交给大模型整理
	let usage: Usage | undefined;
	for await (const e of runAgent(modelRef.current, workingMessages, [
		saveMemoryTool,
		forgetMemoryTool,
		skipReply,
	])) {
		switch (e.type) {
			case "tool_call":
				logger(`采集记忆：调用${e.name}`, e.args);
				break;
			case "tool_result":
				logger(`采集记忆结果：${e.name}`, e.result);
				break;
			case "done":
				usage = e.usage;
				break;
			case "error":
				throw new Error(e.message);
		}
	}
	usage && logger("采集记忆消耗：", usage, "\n");
};
