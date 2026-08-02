import {
	type AI,
	createXMLText,
	extractErrorMessage,
	fetcher,
	logger,
	to,
} from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import config from "@/config.js";
import { Mem0SearchResponseSchema } from "../schemas/mem0.js";
import { contentToMessage } from "./convert.js";

const mem0 = fetcher("https://api.mem0.ai/v3/memories", {
	headers: {
		Authorization: `Token ${config.apiKeys.mem0ApiKey}`,
	},
});

/**
 * 是否已配置 mem0 API Key
 * 未配置时跳过所有记忆读写（不发请求、不报错、不注入），
 * 保证没有 Key 也能正常运行，只是记忆功能整体关闭
 */
const hasMem0ApiKey = () => Boolean(config.apiKeys.mem0ApiKey);

/**
 * 注入一条<memory>消息：内容为空时用占位文本，
 * 让模型知道记忆系统存在、但当前没有搜到相关内容
 */
const pushMemoryMessage = (messages: AI.Message[], serialized: string) => {
	// { role: "user", content: "<memory>\n{serialized}\n</memory>" }
	messages.push(
		contentToMessage(createXMLText("memory", serialized || "（暂无相关记忆）")),
	);
};

/**
 * 给上下文底部注入一条<memory>消息
 * @param messages 上下文，会在底部注入role=user content=<memory>的临时消息
 * @param query 要搜索的记忆内容
 * @param userId 用户标识，此处传QQ号
 * @remarks 不抛异常；即使搜索失败也会注入占位记忆，保证模型始终能看到<memory>消息
 */
export const injectMemory = async (
	messages: AI.Message[],
	query: string,
	userId?: number | string,
) => {
	// 未配置 mem0 Key 时静默跳过，连占位<memory>也不注入
	if (!hasMem0ApiKey()) {
		return;
	}

	const filters = userId ? { user_id: String(userId) } : undefined;

	// https://docs.mem0.ai/api-reference/memory/search-memories
	const [error, response] = await to(
		mem0.post("/search/", {
			query,
			filters,
			top_k: 10,
		}),
	);
	if (error) {
		logger(`注入记忆失败：${error.message}`);
		pushMemoryMessage(messages, "");
		return;
	}
	const validation = safeParse(Mem0SearchResponseSchema, response);
	if (!validation.success) {
		logger(`注入记忆失败：${validation.issues[0].message}`);
		pushMemoryMessage(messages, "");
		return;
	}
	const { results } = validation.output;

	// { A: { uuid1: "24岁", uuid2: "是学生" }, B: {...} }
	const memoriesByUserId = results.reduce(
		(acc, result) => {
			const { user_id, id, memory } = result;
			acc[user_id] ??= {};
			acc[user_id][id] = memory;
			return acc;
		},
		{} as Record<string, Record<string, string>>,
	);

	// "A:\nuuid1: 24岁\nuuid2: 是学生\n\nB:\n..."
	const serialized = Object.entries(memoriesByUserId)
		.map(
			([key, value]) =>
				`${key}:\n${Object.entries(value)
					.map(([uuid, memory]) => `${uuid}: ${memory}`)
					.join("\n")}`,
		)
		.join("\n");
	console.log(serialized)
	pushMemoryMessage(messages, serialized);
};

/**
 * 收回本轮注入的<memory>消息
 * 模型处理失败（index.ts的catch块）时调用，把 injectMemory 注入的临时记忆消息
 * 从上下文移除，避免失败轮次的记忆残留并被持久化到本地
 * @param messages 上下文消息数组
 */
export const removeInjectedMemory = (messages: AI.Message[]) => {
	// 本轮注入的<memory>是数组里最后一条内容含<memory>标签的消息：
	// 历史上成功轮次的<memory>也会留在数组里，但它们位置靠前，
	// 所以从后往前查找只会命中本轮这条，不会误删历史记忆
	const index = messages.findLastIndex(
		(message) =>
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
	if (!hasMem0ApiKey()) {
		return;
	}

	try {
		if (!memoryId) {
			await mem0.post("/add/", {
				user_id: String(userId),
				// 把text原封不动地存入记忆，无需mem0内置的模型来提取内容
				infer: false,
				messages: [contentToMessage(text, { role: "assistant" })],
			});
		} else {
			await mem0.put(`/${memoryId}/`, {
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
	// 未配置 mem0 Key 时静默跳过，不删除也不报错
	if (!hasMem0ApiKey()) {
		return;
	}

	const [error] = await to(mem0.delete(`/${memoryId}/`));
	if (error) {
		logger(`记忆保存失败：${error.message}`);
	}
};
