import { to } from "@nickyzj2023/utils";
import type { GroupMessageEvent } from "../../schemas/onebot/http-post";
import { isTextSegment, reply } from "../../utils/onebot";
import { onebotToOpenai } from "../../utils/openai";
import ai from "./ai";
import nbnhhsh from "./nbnhhsh";

export const handleText = async (e: GroupMessageEvent) => {
	// 先尝试匹配纯英文缩写，调用能不能好好说话
	const [segment1] = e.message;
	if (isTextSegment(segment1)) {
		const { text } = segment1.data;
		if (/^[A-Za-z]+$/.test(text) && !nbnhhsh.IGNORED_TEXTS.includes(text)) {
			return nbnhhsh.handle(text);
		}
	}

	// 再尝试把 OneBot 消息段转成 OpenAI API 消息，调用模型处理
	const [error, messages] = await to(
		onebotToOpenai(e, {
			enableImageUnderstanding: true,
		}),
	);
	if (error) {
		return reply(`消息解析失败：${error.message}`);
	}
	return ai.chat(messages, e);
};
