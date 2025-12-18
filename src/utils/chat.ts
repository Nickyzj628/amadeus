// --- OpenAI API 消息相关工具 ---

import type { Segment } from "../schemas/onebot/http-post";
import type { ChatCompletionMessage } from "../schemas/openai";

export const makeChatCompletionMessage = (
	role: string,
	name: string,
	content: string,
): ChatCompletionMessage => ({
	role,
	name,
	content,
});

/** 把 OneBot 格式的消息段转换成 OpenAI API 格式的消息对象 */
export const segmentToMessage = (input: Segment) => {
	const output = "";
	return output;
};
