import type { GroupMessageEvent } from "@/schemas/onebot/http-post";
import type { Model } from "@/schemas/openai";
import { reply } from "@/utils/onebot";
import chat from "./chat";
import summarize from "./summarize";

/** 聊天模型列表，必须兼容 OpenAI API */
const models = [
	Bun.env.GLM_API_KEY &&
		({
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.7",
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

/** 正在生成消息的群号 */
let pendingGroupIds: number[] = [];

/** 根据指定场景（chat、summarize、...）生成回复内容 */
const handle = async (scene: "chat" | "summarize", e: GroupMessageEvent) => {
	const groupId = e.group_id;
	if (pendingGroupIds.includes(groupId)) {
		return reply("正在处理上一条消息，请稍候……");
	}
	pendingGroupIds.push(groupId);

	let text = "";
	if (scene === "chat") {
		text = await chat(e);
	}
	if (scene === "summarize") {
		text = await summarize(groupId);
	}
	pendingGroupIds = pendingGroupIds.filter((id) => id !== groupId);
	return reply(text);
};

export default {
	models,
	specialModels,
	activeModel,
	changeModel,
	handle,
};
