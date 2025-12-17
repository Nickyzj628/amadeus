import { array, type InferOutput, number, object, string } from "valibot";

export type Model = {
	name: string;
	aliases: string[];
	baseUrl: string;
	apiKey: string;
	model: string;
	maxTokens: number;
	extraBody?: Record<string, any>;
	extraOptions?: Record<string, any>;
};

export type ChatCompletionMessage = {
	name?: string;
	role: string;
	content: string;
};

const MessageSchema = object({
	content: string(),
	role: string(),
});

const ChoiceSchema = object({
	finish_reason: string(),
	index: number(),
	message: MessageSchema,
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
