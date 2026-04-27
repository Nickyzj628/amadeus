import {
	array,
	type InferOutput,
	literal,
	object,
	optional,
	string,
	union,
} from "valibot";

export const MessageContentTextSchema = object({
	type: literal("text"),
	text: string(),
});

export const MessageContentImageSchema = object({
	type: literal("image_url"),
	image_url: object({
		url: string(),
	}),
});
export type MessageContentImage = InferOutput<typeof MessageContentImageSchema>;

export const MessageContentSchema = union([
	string(),
	array(union([MessageContentTextSchema, MessageContentImageSchema])),
]);

export const SystemMessageSchema = object({
	role: literal("system"),
	content: MessageContentSchema,
});

export const UserMessageSchema = object({
	role: literal("user"),
	content: MessageContentSchema,
});

export const ToolCallSchema = object({
	id: string(),
	type: literal("function"),
	function: object({
		name: string(),
		arguments: string(),
	}),
});

export const ToolMessageSchema = object({
	role: literal("tool"),
	content: MessageContentSchema,
});

export const AssistantMessageSchema = object({
	role: literal("assistant"),
	content: string(),
	tool_calls: optional(array(ToolCallSchema)),
});

export const MessageSchema = union([
	SystemMessageSchema,
	UserMessageSchema,
	ToolMessageSchema,
	AssistantMessageSchema,
]);
export type Message = InferOutput<typeof MessageSchema>;
