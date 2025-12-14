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
	IGNORED_TEXT: ["myspoon", "myfork"],

	Schema: array(
		object({
			name: string(),
			trans: optional(array(string())),
		}),
	),

	handle: async (text: string) => {
		const [error, response] = await to(
			fetcher("https://lab.magiconch.com/api").post("/nbnhhsh/guess", { text }),
		);
		if (error) {
			return reply(`调用nbnhhsh出错：${error.message}`);
		}

		const validation = safeParse(Nbnhhsh.Schema, response);
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

/** 兼容 OpenAI API 的大模型 */
export const Ai = {
	messages: [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
	] as ChatCompletionMessage[],

	models: [
		{
			name: "DeepSeek",
			aliases: ["deepseek", "ds"],
			baseUrl: "https://api.deepseek.com",
			apiKey: Bun.env.DEEPSEEK_API_KEY,
			model: "deepseek-chat",
			maxTokens: 128 * 1000, // 128k
		},
		{
			name: "Gemini",
			aliases: ["gemini"],
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: Bun.env.GEMINI_API_KEY,
			model: "gemini-2.5-flash",
			maxTokens: 1000 * 1000, // 100w
		},
		{
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.6",
			maxTokens: 200 * 1000, // 200k
		},
	] as Model[],

	// --- 切换模型相关逻辑 ---
	_currentModelIndex: 0,

	get model() {
		return this.models[this._currentModelIndex] as Model;
	},

	changeModel(nameOrAlias = "") {
		const modelIndex = Ai.models.findIndex(
			(model) =>
				model.name.toLowerCase() === nameOrAlias.toLowerCase() ||
				model.aliases.includes(nameOrAlias.toLowerCase()),
		);
		const model = Ai.models[modelIndex];
		if (!model) {
			return null;
		}

		this._currentModelIndex = modelIndex;
		return model;
	},

	// --- 请求相关逻辑 ---
	_isPending: false,

	async handle(text: string, e: GroupMessageEvent) {
		if (this._isPending) {
			return reply("正在处理上一条消息，请稍候。");
		}

		this._isPending = true;
		this.messages.push({
			role: "user",
			name: `${e.sender.nickname}（${e.sender.user_id}）`,
			content: text,
		});

		const [error, response] = await to(
			fetcher(this.model.baseUrl).post<OpenAIResponse>(
				"/chat/completions",
				{
					model: this.model.model,
					messages: this.messages,
				},
				{
					headers: {
						Authorization: `Bearer ${this.model.apiKey}`,
					},
					proxy: "http://127.0.0.1:7890",
				},
			),
		);
		if (error) {
			this.messages.pop();
			return reply(`消息生成失败：${error.message}`);
		}

		const { content } = response.choices[0]?.message ?? {};
		if (!content) {
			this.messages.pop();
			return reply("生成的消息为空，快找群主排查！");
		}

		// 如果当前对话上下文 token 超过最大限制，则截断中间 1/3 的消息数量
		this.messages.push({ role: "assistant", content });
		const { total_tokens = 0 } = response.usage ?? {};
		if (total_tokens >= this.model.maxTokens) {
			this.messages.splice(1, Math.floor(this.messages.length / 3));
			timeLog("AI聊天上下文过长，已删除前1/3条消息");
		}
		this._isPending = false;

		return reply(content);
	},
};

// --- 分流处理文本 ---

export const handlePlainText = (text: string, e: GroupMessageEvent) => {
	if (/^[A-Za-z]+$/.test(text) && !Nbnhhsh.IGNORED_TEXT.includes(text)) {
		return Nbnhhsh.handle(text);
	}
	return Ai.handle(text, e);
};
