// --- OpenAI API 消息相关工具 ---

import type { ChatCompletionMessage } from "../schemas/openai";

export const textToMessage = (
	text: string,
	args?: Partial<Omit<ChatCompletionMessage, "content">>,
) => {
	const message: ChatCompletionMessage = {
		role: args?.role ?? "user",
		content: text,
	};
	if (args?.name) {
		message.name = args.name;
	}
	return message;
};
