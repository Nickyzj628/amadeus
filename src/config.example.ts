/**
 * 配置文件
 * 重命名为config.ts后填入你的实际配置
 */

import type { AI } from "@nickyzj2023/utils";
import type { McpServer } from "./openai/utils/mcp.js";

export default {
	/** 机器人核心配置 */
	bot: {
		/** 机器人QQ号 */
		selfId: "12345678",
		/** OneBotHTTP服务端口号（用于机器人主动发送请求） */
		onebotHttpPort: 7280,
		/** OneBot HTTP POST服务端口号（用于机器人接收消息） */
		onebotHttpPostPort: 8210,
	},

	/** 模型列表，需满足以下条件：
	 * 1. 必须支持OpenAI API Compatible请求格式
	 * 2. 至少提供一个能理解图片的模型
	 * 3. 最好支持工具调用，否则无法调用Function Calling/MCP工具
	 */
	models: [
		// 主力模型
		{
			model: "deepseek-v4-flash",
			baseUrl: "https://api.deepseek.com",
			apiKey: "xxxxx",
			context: 1000000,
			inputs: ["text"],
		},
		// 辅助模型，用于翻译图片/音频/视频等内容
		{
			model: "gemini-3.1-flash-lite",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: "xxxxx",
			context: 1000000,
			inputs: ["text", "image", "audio", "video"],
		},
	] as AI.Model[],

	/** 各种工具需要的API密钥（可选） */
	apiKeys: {
		/**
		 * 心知天气私钥，用于查询城市三日天气
		 * @see https://www.seniverse.com/dashboard
		 * @remarks 控制台 - 我的产品 - 免费版 - API 密钥 - 私钥
		 */
		seniversePrivateKey: "xxxxx",
	},

	/**
	 * 远程MCP工具（可选）
	 */
	mcpServers: {
		/**
		 * exa联网搜索
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
	 * 一些优化体验的配置（建议不动）
	 */
	etc: {
		/** 未被@时的回复概率 */
		replyProbabilityNotAt: 0.02,
		/** 同时活跃的群聊数，超过时会释放不活跃的群聊消息内存 */
		maxActiveGroupCount: 2,
		/** 安全词，在消息中检测到时添加人设锚点，修正人设 */
		safeWord: "myfork",
		/** 上下文>总上下文*ratio时压缩工具调用结果 */
		compactToolResultRatio: 0.6,
		/** 上下文>总上下文*ratio时压缩图片/音频/视频消息 */
		compactAssetRatio: 0.7,
		/** 上下文>总上下文*ratio时总结消息 */
		compactRatio: 0.8,
	},
};
