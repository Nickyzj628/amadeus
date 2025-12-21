import type { GroupMessageEvent } from "../../schemas/onebot/http-post";
import type { ChatCompletionInputMessage } from "../../schemas/openai";
import { reply } from "../../utils/onebot";
import ai from "./ai";
import nbnhhsh from "./nbnhhsh";

export const handleMessages = (
	messages: ChatCompletionInputMessage[],
	e: GroupMessageEvent,
) => {
	if (messages.length === 0) {
		return reply("消息解析失败了，快找群主排查！");
	}

	const text1 = messages[0]!.content;
	if (/^[A-Za-z]+$/.test(text1) && !nbnhhsh.IGNORED_TEXTS.includes(text1)) {
		return nbnhhsh.handle(text1);
	}

	return ai.chat(messages, e);
};
