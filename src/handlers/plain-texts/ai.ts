import { fetcher, timeLog, to } from "@nickyzj2023/utils";
import { SUMMARIZE_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../../constants";
import type { GroupMessageEvent } from "../../schemas/onebot/http-post";
import type {
	ChatCompletionMessage,
	Model,
	OpenAIResponse,
} from "../../schemas/openai";
import { reply } from "../../utils/onebot";
import { textToMessage } from "../../utils/openai";

/** 模型列表，全部兼容 OpenAI API */
const models: Model[] = [
	Bun.env.GLM_API_KEY && {
		name: "智谱清言",
		aliases: ["chatglm", "glm"],
		baseUrl: "https://open.bigmodel.cn/api/paas/v4",
		apiKey: Bun.env.GLM_API_KEY,
		model: "glm-4.6",
		maxTokens: 200 * 1000, // 200k
		extraBody: {
			thinking: {
				type: "disabled",
			},
		},
	},
	Bun.env.DEEPSEEK_API_KEY && {
		name: "DeepSeek",
		aliases: ["deepseek", "ds"],
		baseUrl: "https://api.deepseek.com",
		apiKey: Bun.env.DEEPSEEK_API_KEY,
		model: "deepseek-chat",
		maxTokens: 128 * 1000, // 128k
	},
	Bun.env.GEMINI_API_KEY && {
		name: "Gemini",
		aliases: ["gemini"],
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		apiKey: Bun.env.GEMINI_API_KEY,
		model: "gemini-3-flash-preview",
		maxTokens: 1000 * 1000, // 100w
		extraBody: {
			reasoning_effort: "none",
		},
		extraOptions: {
			proxy: "http://127.0.0.1:7890",
		},
	},
].filter((model) => !!model);

let activeModel = models[0];

/** 切换模型，如果不存在则返回 null */
const changeModel = (nameOrAlias = "") => {
	const target = nameOrAlias.toLowerCase();
	const model = models.find(
		(model) =>
			model.name.toLowerCase() === target ||
			model.aliases.includes(target) ||
			model.model === target,
	);
	if (!model) {
		return null;
	}

	activeModel = model;
	return activeModel;
};

// --- 聊天相关逻辑，消息按群号划分 ---

/** 所有消息，后期放到 sqlite 数据表里 */
export const groupFullMessagesMap: Record<string, ChatCompletionMessage[]> = {};
/** 和机器人有关的消息 */
export const groupMessagesMap: Record<string, ChatCompletionMessage[]> = {};
/** 是否正在生成消息 */
const groupPendingMap: Record<string, boolean> = {};

/** 向当前模型发送请求，返回回复内容 */
const sendRequest = async (
	groupId: number,
	messages: ChatCompletionMessage[],
	options?: {
		model?: Model;
	},
) => {
	const model = options?.model || activeModel;
	if (!model) {
		throw new Error(
			"当前没有运行中的模型，@我并输入“/模型 <模型名称>”启用一个",
		);
	}

	if (groupPendingMap[groupId]) {
		throw new Error("正在处理上一条消息，请稍候……");
	}
	groupPendingMap[groupId] = true;

	const [error, response] = await to(
		fetcher(model.baseUrl).post<OpenAIResponse>(
			"/chat/completions",
			{
				model: model.model,
				messages,
				...model.extraBody,
			},
			{
				headers: {
					Authorization: `Bearer ${model.apiKey}`,
				},
				...model.extraOptions,
			},
		),
	);
	groupPendingMap[groupId] = false;

	if (error) {
		throw new Error(error.message);
	}

	const { content } = response.choices[0]?.message ?? {};
	if (!content) {
		throw new Error("生成的消息为空，快找群主排查！");
	}

	// 如果当前对话上下文 token 超过最大限制，则截断前半段消息
	const { total_tokens = 0 } = response.usage ?? {};
	if (total_tokens >= model.maxTokens) {
		const systemPrompts = messages.filter(
			(message) => message.role === "system",
		);

		messages.splice(0, Math.floor(messages.length / 2));
		if (systemPrompts.length > 0) {
			messages.unshift(...systemPrompts);
		}
		timeLog("AI聊天上下文过长，已清理前1/2的消息");
	}

	return content;
};

/** 参与群聊 */
const chat = async (text: string, e: GroupMessageEvent) => {
	const groupId = e.group_id;
	groupMessagesMap[groupId] ||= [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
	];
	const messages = groupMessagesMap[groupId];
	messages.push(
		textToMessage(text, {
			name: `${e.sender.nickname}(${e.sender.user_id})`,
		}),
	);

	const [error, response] = await to(sendRequest(groupId, messages));
	if (error) {
		messages.pop();
		return reply(`消息生成失败：${error.message}`);
	}

	const assistantMessage = { role: "assistant", content: response };
	messages.push(assistantMessage);
	// saveGroupMessage(groupId, assistantMessage);

	return reply(response);
};

// 总结群聊
const summarize = async (groupId: number) => {
	if (!activeModel) {
		return reply("请先配置一个本地模型！");
	}

	const messages = groupFullMessagesMap[groupId] || [];
	const [error, content] = await to(
		sendRequest(
			groupId,
			[
				{ role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
				...messages.slice(-100),
			],
			{ model: activeModel },
		),
	);
	if (error) {
		return reply(`总结失败：${error.message}`);
	}
	return reply(content);
};

export default {
	models,
	activeModel,
	changeModel,

	groupFullMessagesMap,
	groupMessagesMap,

	chat,
	summarize,
};
