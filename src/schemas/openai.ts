export type Model = {
	provider: string;
	model: string;
	baseUrl: string;
	apiKey: string;
	/** 上下文窗口，默认 128k */
	contextWindow: number;
	/** 模型支持的能力 */
	abilities: (
		| "chat" // 基本聊天
		| "structured outputs" // 返回 JSON 数据
		| "function calling" // 调用工具
		| "vision-understanding" // 视觉理解
	)[];
	/** 请求时额外携带的 body 参数 */
	extraBody?: Record<string, any>;
	/** 请求时额外携带的 fetch options，可用于设置代理 */
	extraOptions?: Record<string, any>;
};
