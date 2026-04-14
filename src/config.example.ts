/**
 * 配置文件
 * 复制此文件为 config.ts 后填入你的实际配置
 */

export default {
	/** 机器人核心配置 */
	bot: {
		/** 机器人 QQ 号 */
		selfId: "12345678",
		/** OneBot HTTP 服务端口号（用于机器人主动发送请求） */
		onebotHttpPort: 7280,
		/** OneBot HTTP POST 服务端口号（用于机器人接收消息） */
		onebotHttpPostPort: 8210,
	},

	/** 模型列表，需满足以下条件：
	 * 1. 必须兼容 OpenAI API 请求格式
	 * 2. 尽量是多模态的，否则无法识别图片
	 * 3. 尽量支持工具调用
	 */
	models: [
		{
			/** 提供商名称 */
			provider: "OpenRouter",
			/** 模型 ID */
			model: "google/gemini-3.1-flash-lite-preview",
			/** API 前缀地址 */
			baseUrl: "https://openrouter.ai/api/v1",
			/** API 密钥 */
			apiKey: "xxxxx",
			/** 总上下文大小，128K 约等于 128000，1M 约等于 1048576，不用太精确 */
			totalContext: 1048576,
		},
		{
			provider: "OpenRouter",
			model: "google/gemma-4-31b-it",
			baseUrl: "https://openrouter.ai/api/v1",
			apiKey: "xxxxx",
			totalContext: 262144,
		},
		{
			provider: "本地",
			model: "koboldcpp/gemma-4-E4B-it-Q4_K_M",
			baseUrl: "http://localhost:5001/v1",
			apiKey: "",
			totalContext: 8192,
		},
	],

	/** 各种工具需要的 API 密钥（可选） */
	apiKeys: {
		/**
		 * 心知天气私钥，用于查询城市三日天气
		 * @see https://www.seniverse.com/dashboard
		 * @remarks 控制台 - 我的产品 - 免费版 - API 密钥 - 私钥
		 */
		seniversePrivateKey: "xxxxx",
	},

	/**
	 * 远程 MCP 工具（可选）
	 */
	mcpServers: {
		/**
		 * Tavily 联网搜索
		 * @see https://github.com/tavily-ai/tavily-mcp?tab=readme-ov-file#remote-mcp-server
		 */
		"tavily-remote-mcp": {
			type: "streamable_http",
			url: "https://mcp.tavily.com/mcp/?tavilyApiKey=xxxxx",
			// 如果 MCP 客户端中含有不需要的工具，可以写在这里忽略，减少上下文长度
			ignoredToolNames: [
				"tavily_crawl",
				"tavily_map",
				"tavily_research",
				"tavily_skill",
			],
		},
	},

	/**
	 * B站直播通知推送（可选）
	 */
	brec: {
		/**
		 * 要订阅哪些直播间
		 * 12dora、api、泛式、张哥、星铁
		 */
		roomIds: [544786, 92613, 33989, 5050, 27263119, 213, 4788550],
		/** 要推送到哪些 QQ 群 */
		groupIds: [123456789],
	},

	/**
	 * 一些优化体验的杂项（建议默认）
	 */
	etc: {
		/** 未被 @ 时的回复概率 */
		replyProbabilityNotAt: 0.01,
		/** 单次回复请求次数限制，防止模型无限调用工具 */
		maxRequestCount: 3,
		/** 同时活跃的群聊数，超过时会释放不活跃的群聊消息内存 */
		maxActiveGroupCount: 2,
		/** 安全词，在消息中检测到时添加人设锚点，修正人设 */
		safeWords: ["myword", "myspoon"],
		/** 消息数量达到阈值时总结一部分 */
		summarizeThreshold: 50,
	},
};
