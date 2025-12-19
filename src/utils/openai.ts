// --- OpenAI API 消息相关工具 ---

import type { GroupMessageEvent, Segment } from "../schemas/onebot/http-post";
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

/** 把 OneBot 格式的消息段转换成 OpenAI API 格式的消息对象数组 */
export const segmentToMessage = async (
	e: GroupMessageEvent,
	input: Segment,
) => {
	const output = [];

	const dfs = (input: Segment) => {
		if (input.type === "text") {
			output.push();
			return;
		}
	};
	dfs(input);

	return output;
};
