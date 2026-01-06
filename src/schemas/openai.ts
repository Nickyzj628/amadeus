import { type InferOutput, object, string } from "valibot";

export type Model = {
	name: string;
	baseUrl: string;
	model: string;
	apiKey: string;
	/** 模型用途，默认为纯聊天的 ["chat"] */
	useCases: ("chat" | "image-understanding" | "json")[];
	/** 上下文窗口，默认 128k */
	contextWindow: number;
	/** 请求时额外携带的 body 参数 */
	extraBody?: Record<string, any>;
	/** 请求时额外携带的 fetch options，可用于设置代理 */
	extraOptions?: Record<string, any>;
};

/** OpenAI API 请求失败返回的对象结构 */
export const ChatCompletionErrorSchema = object({
	error: object({
		code: string(),
		message: string(),
	}),
});
export type ChatCompletionError = InferOutput<typeof ChatCompletionErrorSchema>;
