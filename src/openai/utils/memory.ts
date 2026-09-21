import { type Message, runAgent, type Usage } from "@nickyzj2023/ai";
import {
	createXMLText,
	extractErrorMessage,
	extractXmlTagContent,
	fetcher,
	logger,
	to,
} from "@nickyzj2023/utils";
import {
	array,
	type InferOutput,
	nullable,
	object,
	record,
	safeParse,
	string,
	unknown,
} from "valibot";
import config from "@/config.js";
import forgetMemoryTool from "../tools/deleteMemory.js";
import saveMemoryTool from "../tools/saveMemory.js";
import skipReply from "../tools/skipReply.js";
import { COLLECT_MEMORIES_PROMPT } from "./constants.js";
import { contentToMessage } from "./convert.js";
import { modelRef } from "./model.js";

const MemorySchema = object({
	id: string(),
	memory: string(),
	user_id: string(),
	metadata: nullable(record(string(), unknown())),
	updated_at: string(),
	created_at: string(),
});
type Memory = InferOutput<typeof MemorySchema>;

const ReadSchema = object({
	results: array(MemorySchema),
});

// { A: { uuid1: "24岁", uuid2: "是学生" }, B: {...} }
type UserMemoryMap = Record<string, Record<string, string>>;

const mem0 = fetcher("https://api.mem0.ai", {
	headers: {
		Authorization: `Token ${config.apiKeys.mem0ApiKey}`,
	},
});
const hasAPIKey = () => Boolean(config.apiKeys.mem0ApiKey);

/**
 * 构造一条<memory>消息
 * @remarks 内容为空时用占位文本
 * @returns `{ role: "user", content: "<memory>\n{serialized}\n</memory>" }`
 */
const buildMemoryMessage = (memories?: Memory[]) => {
	let serialized = "（暂无相关记忆）";

	const map = memories?.reduce((acc, result) => {
		const { user_id, id, memory } = result;
		if (user_id && memory) {
			acc[user_id] ??= {};
			acc[user_id][id] = memory;
		}
		return acc;
	}, {} as UserMemoryMap);

	if (map) {
		serialized = Object.entries(map)
			.map(([userId, value]) => {
				return `# ${userId}\n${Object.entries(value)
					.map(([uuid, memory]) => `- ${uuid}: ${memory}`)
					.join("\n")}`;
			})
			.join("\n");
		logger(`注入记忆：\n${serialized}`);
	}

	// { role: "user", content: "<memory>\n{serialized}\n</memory>" }
	return contentToMessage(createXMLText("memory", serialized));
};

/**
 * 给上下文底部注入一条<memory>消息
 * @param messages 上下文，会在底部注入role=user content=<memory>的临时消息
 * @param query 要搜索的记忆内容
 * @param userId QQ号，支持数组
 * @remarks 不抛异常；即使搜索失败也会注入占位记忆，保证模型始终能看到<memory>消息
 */
export const injectMemory = async (
	messages: Message[],
	query: string,
	userId?: number | string | (number | string)[],
) => {
	if (!hasAPIKey()) {
		return;
	}

	const filters = userId
		? {
				user_id: Array.isArray(userId)
					? { in: userId.map(String) }
					: String(userId),
			}
		: undefined;

	// https://docs.mem0.ai/api-reference/memory/search-memories
	const [error, response] = await to(
		mem0.post("/v3/memories/search/", {
			query,
			filters,
			top_k: 10,
		}),
	);
	if (error) {
		logger(`注入记忆失败：${error.message}`);
		return;
	}

	const validation = safeParse(ReadSchema, response);
	if (!validation.success) {
		logger(`注入记忆失败：${validation.issues[0].message}`);
		return;
	}

	messages.push(buildMemoryMessage(validation.output.results));
};

/**
 * 收回本轮注入的<memory>消息
 * 模型处理失败（index.ts的catch块）时调用，把injectMemory注入的记忆移除
 */
export const deleteInjectedMemories = (messages: Message[]) => {
	// 本轮注入的<memory>是数组里最后一条内容含<memory>标签的消息：
	// 历史上成功轮次的<memory>也会留在数组里，但它们位置靠前，
	// 所以从后往前查找只会命中本轮这条，不会误删历史记忆
	const index = messages.findLastIndex(
		(message) =>
			message.role === "user" &&
			typeof message.content === "string" &&
			message.content.includes("<memory>"),
	);
	if (index !== -1) {
		messages.splice(index, 1);
	}
};

/**
 * create/update一段记忆
 * @param text 记忆内容
 * @param userId 用户QQ号
 * @param memoryId 记忆UUID，不传就是创建，传了就是更新
 * @remarks 及时保存失败，也不会抛异常
 */
export const saveMemory = async (
	text: string,
	userId: number | string,
	memoryId?: string,
) => {
	// 未配置 mem0 Key 时静默跳过，不保存也不报错
	if (!hasAPIKey()) {
		return;
	}

	try {
		if (!memoryId) {
			await mem0.post("/v3/memories/add/", {
				messages: [contentToMessage(text, { role: "assistant" })],
				user_id: String(userId),
				// 把text原封不动地存入记忆，无需mem0内置的模型来提取内容
				infer: false,
			});
		} else {
			await mem0.put(`/v1/memories/${memoryId}/`, {
				text,
			});
		}
	} catch (e) {
		logger(`记忆保存失败：${extractErrorMessage(e)}`);
	}
};

/**
 * 删除一份记忆
 * @param memoryId 记忆UUID
 */
export const deleteMemory = async (memoryId: string) => {
	if (!hasAPIKey()) {
		return;
	}

	const [error] = await to(mem0.delete(`/v1/memories/${memoryId}/`));
	if (error) {
		logger(`记忆删除失败：${error.message}`);
	}
};

/**
 * 从即将被总结的消息中，采集值得保存的记忆点
 * 相当于让模型把这些消息当一轮对话读一遍，自主决定新增/更新/删除哪些记忆
 * @param dyingMessages 待总结的消息（压缩后原文会被丢弃），只读不改
 * @remarks 不抛异常；采集失败只记日志，不影响调用方继续压缩上下文
 */
export const collectMemories = async (dyingMessages: Message[]) => {
	if (!hasAPIKey()) {
		return;
	}

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
	const userIds = new Set<string>();
	for (const message of collectable) {
		const userId = extractXmlTagContent(message.content as string, "user_id");
		if (userId) {
			userIds.add(userId.replaceAll("\n", ""));
		}
	}
	if (!userIds.size) {
		return;
	}

	// 准备上下文：系统提示词+便于采集记忆的历史消息+用户指令
	const workingMessages: Message[] = [
		{ role: "system", content: COLLECT_MEMORIES_PROMPT },
		...collectable,
		{
			role: "user",
			content: createXMLText("system-reminder", "请根据系统提示词，执行本次任务"),
		},
	];

	// +相关记忆
	const memories: Memory[] = [];
	for (const userId of userIds) {
		const response = await mem0.post("/v3/memories/", {
			filters: { user_id: userId },
		});
		const validation = safeParse(ReadSchema, response);
		if (!validation.success) {
			logger(`查询记忆失败：${validation.issues[0].message}`);
			continue;
		}
		memories.push(...validation.output.results);
	}
	buildMemoryMessage(memories);

	// 交给大模型采集记忆点
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
