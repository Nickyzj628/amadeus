import { type InferOutput, object, string } from "valibot";

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

// export const RoleSchema = union([
// 	literal("user"),
// 	literal("system"),
// 	literal("assistant"),
// 	literal("tool"),
// ]);

/** 基本的字符串消息，content 为字符串 */
// const BaseMessageSchema = object({
// 	role: RoleSchema,
// 	content: string(),
// });
// export type BaseChatCompletionMessage = InferOutput<typeof BaseMessageSchema>;

/** 多模态消息，content 为对象数组 */
// const MultiMessageSchema = object({
// 	role: RoleSchema,
// 	content: array(
// 		union([
// 			object({
// 				type: literal("text"),
// 				text: string(),
// 			}),
// 			object({
// 				type: literal("image_url"),
// 				image_url: object({
// 					url: string(),
// 				}),
// 			}),
// 		]),
// 	),
// });
// export type MultiChatCompletionMessage = InferOutput<typeof MultiMessageSchema>;

/** OpenAI API 请求失败返回的对象结构 */
export const ChatCompletionErrorSchema = object({
	error: object({
		code: string(),
		message: string(),
	}),
});
export type ChatCompletionError = InferOutput<typeof ChatCompletionErrorSchema>;
