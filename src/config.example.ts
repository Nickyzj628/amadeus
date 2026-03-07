/**
 * 配置文件
 * 复制此文件为 config.ts 后填入你的实际配置
 */

export default {
	/** 机器人核心配置 */
	bot: {
		/** 机器人 QQ 号 */
		selfId: "...",
		/** OneBot HTTP 服务端口号（用于机器人主动发送请求） */
		onebotHttpPort: 7280,
		/** OneBot HTTP POST 服务端口号（用于机器人接收消息） */
		onebotHttpPostPort: 8210,
	},

	/** 模型列表
	 * @remarks 模型必须满足以下条件：
	 * 1. 兼容 OpenAI API 请求格式
	 * 2. 多模态，否则无法识别图片
	 */
	models: [
		{
			/** 提供商名称 */
			provider: "OpenRouter",
			/** 模型 ID */
			model: "qwen/qwen3.5-flash-02-23",
			/** API 前缀地址 */
			baseUrl: "https://openrouter.ai/api/v1",
			/** API 密钥 */
			apiKey: "...",
			/** 总上下文大小（token 数，128K 约等于 128000，1M 约等于 1048576） */
			totalContext: 128000,
			/** 请求时携带的额外参数，此处为禁用深度思考 */
			extraBody: {
				reasoning: {
					effort: "none",
				},
			},
		},
	],

	/** API 密钥配置（可选，用于 Function Calling Tools） */
	apiKeys: {
		/**
		 * 心知天气私钥，用于查询城市三日天气
		 * @see https://www.seniverse.com/dashboard
		 * @remarks 控制台 - 我的产品 - 免费版 - API 密钥 - 私钥
		 */
		seniversePrivateKey: "...",
	},

	/** 远程 MCP 服务器配置（可选）
	 * @remarks 工具列表会自动从远程 MCP 服务器的 listTools() API 获取
	 */
	mcpServers: {
		/**
		 * Tavily 联网搜索
		 * @see https://modelscope.cn/mcp/servers/@tavily-ai/tavily-mcp
		 */
		"tavily-mcp": {
			type: "streamable_http",
			url: "...",
		},
	},

	/**
	 * Bilibili 直播通知推送配置（可选）
	 */
	brec: {
		/**
		 * 要订阅哪些直播间
		 * 12dora、api、泛式、张哥、星铁
		 */
		roomIds: [544786, 92613, 33989, 5050, 27263119],
		/** 要推送到哪些 QQ 群 */
		groupIds: [1016022926, 669751957],
	},
};
