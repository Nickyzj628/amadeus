import {
	array,
	type InferOutput,
	nullable,
	number,
	object,
	string,
} from "valibot";
import { AssistantMessageSchema } from "./index.js";

export const ChatCompletionUsageSchema = object({
	prompt_tokens: number(),
	completion_tokens: number(),
	total_tokens: number(),
});
export type ChatCompletionUsage = InferOutput<typeof ChatCompletionUsageSchema>;

export const ChatCompletionChoiceSchema = object({
	message: AssistantMessageSchema,
	finish_reason: string(),
});

export const ChatCompletionSchema = object({
	usage: ChatCompletionUsageSchema,
	choices: array(ChatCompletionChoiceSchema),
});
export type ChatCompletions = InferOutput<typeof ChatCompletionSchema>;
