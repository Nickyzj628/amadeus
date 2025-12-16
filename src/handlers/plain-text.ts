import { fetcher, timeLog, to } from "@nickyzj2023/utils";
import { array, object, optional, safeParse, string } from "valibot";
import { SYSTEM_PROMPT } from "../constants";
import type { GroupMessageEvent } from "../schemas/onebot";
import type {
	ChatCompletionMessage,
	Model,
	OpenAIResponse,
} from "../schemas/openai";
import { reply } from "../utils";

/** 能不能好好说话 */
const Nbnhhsh = {
	IGNORED_TEXTS: ["myspoon", "myfork"],

	_Schema: array(
		object({
			name: string(),
			trans: optional(array(string())),
		}),
	),

	async handle(text: string) {
		const [error, response] = await to(
			fetcher("https://lab.magiconch.com/api").post("/nbnhhsh/guess", { text }),
		);
		if (error) {
			return reply(`调用nbnhhsh出错：${error.message}`);
		}

		const validation = safeParse(this._Schema, response);
		if (!validation.success) {
			return reply(`nbnhhsh返回数据格式有误：${validation.issues[0].message}`);
		}
		const item = validation.output[0];
		if (!item) {
			return reply(`nbnhhsh未找到结果`);
		}

		const items = item.trans || [];
		if (items.length === 0) {
			return reply("未查询到结果，这在我的数据库里没有啊！");
		}
		return reply(`你想说的是不是：${items.join("、")}`);
	},
};

/** AI 聊天模型 */
export const Ai = {
	// 模型列表，只存放配置过 api key 的模型
	models: [
		Bun.env.DEEPSEEK_API_KEY && {
			name: "DeepSeek",
			aliases: ["deepseek", "ds"],
			baseUrl: "https://api.deepseek.com",
			apiKey: Bun.env.DEEPSEEK_API_KEY,
			model: "deepseek-chat",
			maxTokens: 128 * 1000, // 128k
		},
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
		Bun.env.GEMINI_API_KEY && {
			name: "Gemini",
			aliases: ["gemini"],
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
		},
		Bun.env.OLLAMA_MODEL && {
			name: "Ollama",
			aliases: ["ollama"],
			baseUrl: "http://localhost:11434/v1",
			apiKey: "ollama",
			model: Bun.env.OLLAMA_MODEL,
			maxTokens: Bun.env.OLLAMA_MAX_TOKENS || 4 * 1000,
			extraBody: {
				enable_thinking: false,
			},
			extraOptions: {
				proxy: "http://127.0.0.1:7890",
			},
		},
	].filter(Boolean) as Model[],

	// --- 切换模型相关逻辑 ---
	_currentModelIndex: 0,

	get model() {
		return this.models[this._currentModelIndex];
	},

	changeModel(nameOrAlias = "") {
		const target = nameOrAlias.toLowerCase();
		const modelIndex = Ai.models.findIndex(
			(model) =>
				model.name.toLowerCase() === target || model.aliases.includes(target),
		);
		const model = Ai.models[modelIndex];
		if (!model) {
			return null;
		}

		this._currentModelIndex = modelIndex;
		return model;
	},

	// --- 请求相关逻辑 ---

	// 消息列表，按群号划分
	_groupMessagesMap: {} as Record<string, ChatCompletionMessage[]>,
	_groupPendingMap: {} as Record<string, boolean>,

	async handle(text: string, e: GroupMessageEvent) {
		const model = this.model;
		if (!model) {
			return reply("当前没有运行中的模型，请输入“/模型 <模型名称>”应用一个");
		}

		const groupId = e.group_id;

		if (this._groupPendingMap[groupId]) {
			return reply("正在处理上一条消息，请稍候……");
		}
		this._groupPendingMap[groupId] = true;

		this._groupMessagesMap[groupId] ||= [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
		];
		const messages = this._groupMessagesMap[groupId];
		messages.push({
			role: "user",
			name: `${e.sender.nickname}（${e.sender.user_id}）`,
			content: text,
		});

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
		this._groupPendingMap[groupId] = false;
		if (error) {
			messages.pop();
			return reply(`消息生成失败：${error.message}`);
		}

		const { content } = response.choices[0]?.message ?? {};
		if (!content) {
			messages.pop();
			timeLog("生成的消息为空", JSON.stringify(response, null, 2));
			return reply("生成的消息为空，快找群主排查！");
		}

		// 如果当前对话上下文 token 超过最大限制，则截断中间 1/3 的消息数量
		messages.push({ role: "assistant", content });
		const { total_tokens = 0 } = response.usage ?? {};
		if (total_tokens >= this.model.maxTokens) {
			messages.splice(1, Math.floor(messages.length / 3));
			timeLog("AI聊天上下文过长，已删除前1/3条消息");
		}

		return reply(content);
	},
};

// 入口
export const handlePlainText = (text: string, e: GroupMessageEvent) => {
	if (/^[A-Za-z]+$/.test(text) && !Nbnhhsh.IGNORED_TEXTS.includes(text)) {
		return Nbnhhsh.handle(text);
	}
	return Ai.handle(text, e);
};
