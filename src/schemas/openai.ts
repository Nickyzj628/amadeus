import { type InferOutput, object, string } from "valibot";

export type Model = {
	name: string;
	aliases: string[];
	useCase?: "chat" | "image-understanding" | "json";
	baseUrl: string;
	apiKey: string;
	model: string;
	maxTokens: number;
	extraBody?: Record<string, any>;
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
