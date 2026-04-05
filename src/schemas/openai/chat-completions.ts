import {
  array,
  nullable,
  number,
  object,
  string,
  type InferOutput,
} from "valibot";
import { AssistantMessageSchema } from "./index.js";

export const ChatCompletionUsageSchema = object({
  prompt_tokens: number(),
  completion_tokens: number(),
  total_tokens: number(),
});

export const ChatCompletionChoiceSchema = object({
  message: AssistantMessageSchema,
  finish_reason: string(),
  logprobs: nullable(string()),
});

export const ChatCompletionSchema = object({
  usage: ChatCompletionUsageSchema,
  choices: array(ChatCompletionChoiceSchema),
});
export type ChatCompletions = InferOutput<typeof ChatCompletionSchema>;
