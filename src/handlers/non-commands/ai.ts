import { fetcher, timeLog, to } from "@nickyzj2023/utils";
import {
	getIDSystemPrompt as getIdentitySystemPrompt,
	IMAGE_UNDERSTANDING_PROMPT,
	SYSTEM_PROMPT,
} from "../../constants";
import type {
	GroupMessageEvent,
	ImageSegment,
} from "../../schemas/onebot/http-post";
import type {
	ChatCompletionMessage,
	Model,
	OpenAIResponse,
} from "../../schemas/openai";
import { readGroupMessages } from "../../utils/data";
import { reply } from "../../utils/onebot";
import { textToMessage } from "../../utils/openai";

// ================================
// 待抽离到 utils 的代码
// ================================

export async function imageUrlToBase64(imageUrl: string) {
	const response = await fetch(imageUrl);
	const imageArrayBuffer = await response.arrayBuffer();
	const base64ImageData = Buffer.from(imageArrayBuffer).toString("base64");
	return `data:image/jpeg;base64,${base64ImageData}`;
}

// ================================
// 模型定义相关逻辑
// ================================

/** 聊天模型列表，必须兼容 OpenAI API */
const models = [
	Bun.env.GLM_API_KEY &&
		({
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
		} satisfies Model),
	Bun.env.DEEPSEEK_API_KEY &&
		({
			name: "DeepSeek",
			aliases: ["deepseek", "ds"],
			baseUrl: "https://api.deepseek.com",
			apiKey: Bun.env.DEEPSEEK_API_KEY,
			model: "deepseek-chat",
			maxTokens: 128 * 1000, // 128k
		} satisfies Model),
	Bun.env.GEMINI_API_KEY &&
		({
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
		} satisfies Model),
].filter(Boolean) as Model[];

/** 特殊场景（见Model.useCase）使用的模型列表，必须兼容 OpenAI API */
const specialModels = [
	Bun.env.GLM_API_KEY &&
		({
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			useCase: "image-understanding",
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.6v-flashx",
			maxTokens: 200 * 1000, // 200k
			extraBody: {
				thinking: {
					type: "disabled",
				},
			},
		} satisfies Model),
	Bun.env.GEMINI_API_KEY &&
		({
			name: "Gemini",
			aliases: ["gemini"],
			useCase: "image-understanding",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: Bun.env.GEMINI_API_KEY,
			model: "gemini-2.5-flash",
			maxTokens: 1000 * 1000, // 100w
			extraBody: {
				reasoning_effort: "none",
			},
			extraOptions: {
				proxy: "http://127.0.0.1:7890",
			},
		} satisfies Model),
].filter(Boolean) as Model[];

/** 当前模型，默认取 models 第一个 */
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

// ================================
// 聊天相关逻辑
// ================================

/** 正在生成消息的群号 */
let pendingGroupIds: number[] = [];

/**
 * 调用 /chat-completions 接口，返回模型生成的文本
 * @param messages 如果传入的消息列表过长，会在请求后自动清理
 * @param model 默认使用当前模型，也可以手动指定
 */
const chatCompletions = async (
	messages: ChatCompletionMessage[],
	model: Model | undefined = activeModel,
) => {
	if (!model) {
		throw new Error(
			"当前没有运行中的模型，@我并输入“/模型 <模型名称>”启用一个",
		);
	}

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
	if (error) {
		throw new Error(error.message);
	}

	const { content } = response.choices[0]?.message ?? {};
	if (!content) {
		throw new Error("生成的消息为空，快找群主排查！");
	}

	// 如果当前对话上下文 token 超过最大限制，则保留一半
	const { total_tokens = 0 } = response.usage ?? {};
	if (total_tokens >= model.maxTokens) {
		const systemPrompts = messages.filter(
			(message) => message.role === "system",
		);

		messages.splice(0, Math.floor(messages.length / 2));
		if (systemPrompts.length > 0) {
			messages.unshift(...systemPrompts);
		}
		timeLog("AI聊天上下文过长，已清理前半段消息");
	}

	return content as string;
};

/** 参与群聊 */
const chat = async (
	messages: ChatCompletionMessage[],
	e: GroupMessageEvent,
) => {
	const groupId = e.group_id;
	if (pendingGroupIds.includes(groupId)) {
		throw new Error("正在处理上一条消息，请稍候……");
	}

	const groupMessages = readGroupMessages(groupId, [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
		{
			role: "system",
			content: getIdentitySystemPrompt(e.self_id),
		},
	]);
	groupMessages.push(...messages);

	pendingGroupIds.push(groupId);
	const [error, response] = await to(chatCompletions(groupMessages));
	pendingGroupIds = pendingGroupIds.filter((id) => id !== groupId);

	if (error) {
		messages.pop();
		return reply(`消息生成失败：${error.message}`);
	}

	groupMessages.push(
		textToMessage(response, {
			role: "assistant",
		}),
	);
	return reply(response);
};

/** 归纳总结传入的消息列表 */
const summarize = async (messages: ChatCompletionMessage[]) => {
	return reply("施工中……");
	// if (pendingGroupIds.includes(groupId)) {
	// 	throw new Error("正在处理上一条消息，请稍候……");
	// }
	// pendingGroupIds.push(groupId);

	// const messages = readGroupFullMessages(groupId);
	// if (messages.length === 0) {
	// 	throw new Error("没有可以总结的消息");
	// }

	// const [error, content] = await to(
	// 	chatCompletions([
	// 		{ role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
	// 		...messages.slice(-100),
	// 	]),
	// );
	// pendingGroupIds = pendingGroupIds.filter((id) => id !== groupId);

	// if (error) {
	// 	return reply(`总结失败：${error.message}`);
	// }

	// return reply(content);
};

// ================================
// 非直接回复群聊的工具函数
// ================================

/**
 * 把图片识别成自然语言
 * @param image 图片消息段里的 data 对象
 * @see https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8#%E5%9B%BE%E7%89%87
 */
const imageToText = async (image: ImageSegment["data"]) => {
	console.log(image);
	const model = specialModels.find(
		(model) => model.useCase === "image-understanding",
	);
	if (!model) {
		throw new Error("请先配置一个图片理解模型");
	}
	// 把图片地址转成 base64，因为部分模型无法直接访问外部链接
	const imageUrl = image.url;
	const base64 = await imageUrlToBase64(imageUrl);

	const content = await chatCompletions(
		[
			{
				role: "user",
				content: [
					{
						type: "text",
						text: IMAGE_UNDERSTANDING_PROMPT,
					},
					{ type: "image_url", image_url: { url: base64 } },
				],
			},
		],
		model,
	);
	return content;
};

export default {
	models,
	activeModel,
	changeModel,

	chat,
	summarize,

	imageToText,
};
