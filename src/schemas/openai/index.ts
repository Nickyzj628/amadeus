export * from "./chat-completions.js";
export * from "./message.js";

export type Model = {
	provider: string;
	model: string;
	baseUrl: string;
	apiKey: string;
	/** 上下文窗口，默认 128k */
	totalContext: number;
	/** 请求时额外携带的 body 参数 */
	extraBody?: Record<string, any>;
};
