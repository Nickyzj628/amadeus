export type Model = {
	provider: string;
	model: string;
	baseUrl: string;
	apiKey: string;
	/** 上下文窗口，默认 128k */
	contextWindow: number;
	/** 请求时额外携带的 body 参数 */
	extraBody?: Record<string, any>;
	/** 请求时额外携带的 fetch options，可用于设置代理 */
	extraOptions?: Record<string, any>;
};
