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

const MessageSchema = object({
	role: string(),
	content: union([
		string(),
		array(
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
	]),
});

/** 用于输入的消息，content 为字符串 */
const MessageInputSchema = object({
	role: string(),
	content: string(),
});

/** 用于对外发出请求的消息，content 为对象数组 */
const MessageOutputSchema = object({
	role: string(),
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

export type ChatCompletionMessage = InferOutput<typeof MessageSchema>;
export type ChatCompletionInputMessage = InferOutput<typeof MessageInputSchema>;
export type ChatCompletionOutputMessage = InferOutput<
	typeof MessageOutputSchema
>;

const ChoiceSchema = object({
	finish_reason: string(),
	index: number(),
	message: MessageInputSchema,
});

const UsageSchema = object({
	completion_tokens: number(),
	prompt_tokens: number(),
	total_tokens: number(),
});

export const OpenAIResponseSchema = object({
	choices: array(ChoiceSchema),
	created: number(),
	id: string(),
	model: string(),
	object: string(),
	usage: UsageSchema,
});

export type OpenAIResponse = InferOutput<typeof OpenAIResponseSchema>;
