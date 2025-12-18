import { fetcher, timeLog, to } from "@nickyzj2023/utils";
import { array, message, object, optional, safeParse, string } from "valibot";
import { SUMMARIZE_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../constants";
import type { GroupMessageEvent } from "../schemas/onebot/http-post";
import type {
	ChatCompletionMessage,
	Model,
	OpenAIResponse,
} from "../schemas/openai";
import { reply } from "../utils/onebot";

/** AI 聊天模型 */
export const Ai = {};

// 入口
export const handlePlainText = (e: GroupMessageEvent, text: string) => {
	if (/^[A-Za-z]+$/.test(text) && !Nbnhhsh.IGNORED_TEXTS.includes(text)) {
		return Nbnhhsh.handle(text);
	}
	return Ai.chat(e, message);
};
