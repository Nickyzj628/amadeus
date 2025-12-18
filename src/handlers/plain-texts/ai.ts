import type { Model } from "../../schemas/openai";

// 模型列表，只存放配置过 api key 的模型
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
		aliases: ["ollama", "qwen3:0.6b"],
		baseUrl: "http://localhost:11434/v1",
		apiKey: "ollama",
		model: Bun.env.OLLAMA_MODEL,
		maxTokens: Bun.env.OLLAMA_MAX_TOKENS || 4 * 1000,
		extraBody: {
			extra_body: {
				enable_thinking: false,
			},
		},
	},
].filter(Boolean) as Model[];

// --- 切换模型 ---

const currentModelIndex = 0;

const model = models[currentModelIndex];

changeModel((nameOrAlias = ""));
{
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
}
,

	// --- 聊天 ---

	// 消息列表，按群号划分
	// 所有消息，后期放到 sqlite 数据表里
	groupFullMessagesMap:
{
}
as;
Record<string, ChatCompletionMessage[]>,
	// 和机器人有关的消息
	_groupMessagesMap;
:
{
}
as;
Record<string, ChatCompletionMessage[]>,
	// 是否正在生成消息
	_groupPendingMap;
:
{
}
as;
Record<string, boolean>,
	// 向当前模型发送请求，返回回复内容
	async;
sendRequest(
		groupId: number,
		messages: ChatCompletionMessage[],
		options?: {
			model?: Model;
},
	)
{
	const model = options?.model || this.model;
	if (!model) {
		throw new Error(
			"当前没有运行中的模型，@我并输入“/模型 <模型名称>”启用一个",
		);
	}

	if (this._groupPendingMap[groupId]) {
		throw new Error("正在处理上一条消息，请稍候……");
	}
	this._groupPendingMap[groupId] = true;
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
}
,

	// 参与群聊
	async chat(e: GroupMessageEvent, content: string)
{
	const groupId = e.group_id;
	this._groupMessagesMap[groupId] ||= [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
	];
	const messages = this._groupMessagesMap[groupId];
	messages.push(makeChatCompletionMessage({ content }));

	const [error, response] = await to(this.sendRequest(groupId, messages));
	if (error) {
		messages.pop();
		return reply(`消息生成失败：${error.message}`);
	}

	const assistantMessage = { role: "assistant", content: response };
	messages.push(assistantMessage);
	// saveGroupMessage(groupId, assistantMessage);

	return reply(response);
}
,

	// 总结群聊
	async summarize(groupId: number)
{
	const model = this.models.find((model) => model.name === "Ollama");
	if (!model) {
		return reply("请先配置一个本地模型！");
	}

	const messages = this.groupFullMessagesMap[groupId] || [];
	const [error, content] = await to(
		this.sendRequest(
			groupId,
			[{ role: "system", content: SUMMARIZE_SYSTEM_PROMPT }, ...messages],
			{ model },
		),
	);
	if (error) {
		return reply(`总结失败：${error.message}`);
	}
	return reply(content);
}
,
