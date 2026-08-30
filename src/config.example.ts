/**
 * 配置文件
 * 复制此文件为 config.ts 后填入你的实际配置
 */

import type { Model } from "@nickyzj2023/ai";
import type { McpServer } from "./openai/utils/mcp.js";

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
			model: "deepseek-v4-flash",
			baseUrl: "https://api.deepseek.com",
			apiKey: "sk-xxxxx",
			modalities: ["text"],
		},
		{
			model: "google/gemini-3.5-flash-lite",
			baseUrl: "https://openrouter.ai/api/v1",
			apiKey: "sk-or-v1-xxxxx",
			modalities: ["text", "image", "audio", "video"],
		},
		{
			model: "gemma-4-31b-it",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: "xxxxx",
			modalities: ["text", "image", "audio", "video"],
		},
	] as Model[],

	/** 各种工具需要的API密钥（可选） */
	apiKeys: {
		/**
		 * 心知天气私钥，用于查询城市三日天气
		 * @see https://www.seniverse.com/dashboard
		 * @remarks 控制台 - 我的产品 - 免费版 - API 密钥 - 私钥
		 */
		seniversePrivateKey: "xxxxx",
		/**
		 * Mem0密钥，用于记录用户的习惯偏好
		 * @see https://app.mem0.ai/dashboard/api-keys
		 */
		mem0ApiKey: "m0-xxxxx",
	},

	/**
	 * 远程 MCP 工具（可选）
	 */
	mcpServers: {
		/**
		 * exa 联网搜索
		 * @see https://exa.ai/docs/reference/exa-mcp
		 */
		exa: {
			type: "streamable_http",
			url: "https://mcp.exa.ai/mcp",
			headers: {
				"x-api-key": "xxxxx",
			},
		},
	} satisfies Record<string, McpServer>,

	/**
	 * B站直播通知推送（可选）
	 */
	brec: {
		/**
		 * 要订阅哪些UP主的直播（填写用户主页上的UID）
		 * 泛式、张哥、星铁
		 */
		uids: [63231, 433351, 1340190821],
		/** 要推送到哪些 QQ 群 */
		groupIds: [1234567890],
	},

	/**
	 * 一些优化体验的杂项（建议默认）
	 */
	etc: {
		/** 未被@时的回复概率 */
		replyProbabilityNotAt: 0.02,
		/** 同时活跃的群聊数，超过时会释放不活跃的群聊消息内存 */
		maxActiveGroupCount: 2,
		/** 安全词，在消息中检测到时添加人设锚点，修正人设 */
		safeWord: "myfork",
		/** 上下文>总上下文*ratio时压缩工具调用结果 */
		ratioToCompactToolResult: 0.5,
		/** 上下文>总上下文*ratio时压缩图片/音频/视频消息 */
		ratioToCompactMedia: 0.6,
		/** 上下文>总上下文*ratio时清理软删除残留的占位消息 */
		ratioToClearSoftDeletedMessages: 0.7,
		/** 上下文>总上下文*ratio时总结消息 */
		ratioToSummarize: 0.8,
		/** 总结消息最长字数，超过时将删除日期最早的一段 */
		limitOfSummary: 2200,
		/** 自动压缩N天前的消息 */
		summarizeNDay: 7,
	},
};
