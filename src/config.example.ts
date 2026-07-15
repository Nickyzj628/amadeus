/**
 * 配置文件
 * 复制此文件为 config.ts 后填入你的实际配置
 */

import type { Model } from "./openai/schemas/model.js";

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
	 * 2. 至少提供一个能理解图片的模型
	 * 3. 最好支持工具调用，否则无法调用 Function Calling / MCP 工具
	 */
	models: [
		{
			/** 提供商名称 */
			provider: "DeepSeek",
			/** 模型 ID */
			model: "deepseek-v4-flash",
			/** API 前缀地址 */
			baseUrl: "https://api.deepseek.com",
			/** API 密钥 */
			apiKey: "xxxxx",
			/** 总上下文大小，128K 约等于 128000，1M 约等于 1048576，不用太精确 */
			totalContext: 1048576,
			/**
			 * 支持的输入格式，text/image/file/audio/video
			 * 若当前使用的模型不支持图片理解，则会寻找其他多模态模型把图片翻译成自然语言
			 */
			inputModalities: ["text"],
		},
		/** 使用免费的 Gemma 4 用于翻译图片 */
		{
			provider: "Google AI Studio",
			model: "gemma-4-26b-a4b-it",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: "xxxxx",
			totalContext: 262144,
			inputModalities: ["text", "image"],
			/** 额外携带的请求体，此处为禁用思考 */
			extraBody: {
				reasoning_effort: "minimal",
			},
		},
		/** 也支持本地模型 */
		{
			provider: "本地",
			model: "koboldcpp/gemma-4-E4B-it-Q4_K_M",
			baseUrl: "http://localhost:5001/v1",
			apiKey: "",
			totalContext: 16384,
			inputModalities: ["text", "image"],
		},
	] as Model[],

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
			// 如果MCP服务不支持在url里直接携带apikey，则还有在请求头内携带的方法
			// headers: {
			//      "x-api-key": "dfd5de63-4a4f-4fc2-87d7-8f20abad5d18",
			//    },
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
		 * 要订阅哪些UP主的直播（填写用户主页上的UID）
		 * 12dora、api、泛式、张哥、星铁、小肉包
		 */
		uids: [70093, 13046, 63231, 433351, 1340190821, 67141],
		/** 要推送到哪些 QQ 群 */
		groupIds: [123456789],
	},

	/**
	 * 一些优化体验的杂项（建议默认）
	 */
	etc: {
		/** 未被 @ 时的回复概率 */
		replyProbabilityNotAt: 0.01,
		/** 同时活跃的群聊数，超过时会释放不活跃的群聊消息内存 */
		maxActiveGroupCount: 2,
		/** 安全词，在消息中检测到时添加人设锚点，修正人设 */
		safeWord: "myfork",
	},
};
