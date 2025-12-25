import {
	array,
	type InferOutput,
	literal,
	number,
	object,
	string,
	union,
} from "valibot";

export type Model = {
	name: string;
	aliases: string[];
	useCase?: "chat" | "image-understanding" | "image-generation";
	baseUrl: string;
	apiKey: string;
	model: string;
	maxTokens: number;
	extraBody?: Record<string, any>;
	extraOptions?: Record<string, any>;
};

export const RoleSchema = union([
	literal("user"),
	literal("system"),
	literal("assistant"),
	literal("tool"),
]);

/** 基本的字符串消息，content 为字符串 */
const BaseMessageSchema = object({
	role: RoleSchema,
	content: string(),
});
export type BaseChatCompletionMessage = InferOutput<typeof BaseMessageSchema>;

/** 多模态消息，content 为对象数组 */
const MultiMessageSchema = object({
	role: RoleSchema,
	content: array(
		union([
			object({
				type: literal("text"),
				text: string(),
			}),
			object({
				type: literal("image_url"),
				image_url: object({
					url: string(),
				}),
			}),
		]),
	),
});
export type MultiChatCompletionMessage = InferOutput<typeof MultiMessageSchema>;

/** OpenAI API 请求返回的对象结构 */
export const OpenAIResponseSchema = object({
	choices: array(
		object({
			finish_reason: string(),
			index: number(),
			message: BaseMessageSchema,
		}),
	),
	created: number(),
	id: string(),
	model: string(),
	object: string(),
	usage: object({
		completion_tokens: number(),
		prompt_tokens: number(),
		total_tokens: number(),
	}),
});
export type OpenAIResponse = InferOutput<typeof OpenAIResponseSchema>;

/**
 * 模型请求中的工具定义格式
 */
export type ToolDefinition = {
	type: "function";
	function: {
		name: string;
		description?: string;
		parameters: Record<string, any>;
	};
};

/**
 * 模型返回的调用指令类型
 */
export type ToolCall = {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string; // 注意：API 返回的是 JSON 字符串，需要 JSON.parse()
	};
};

/**
 * 发送回模型的工具执行结果格式
 */
export type ToolMessage = {
	role: "tool";
	tool_call_id: string;
	name: string;
	content: string; // 执行结果必须转为字符串
};
