import { camelToSnake, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { SUMMARIZE_SYSTEM_PROMPT } from "@/constants";
import { GetMessageHistoryResponseSchema } from "@/schemas/onebot/http";
import type { ChatCompletionInputMessage } from "@/schemas/openai";
import { http } from "@/utils/onebot";
import { onebotToOpenai } from "@/utils/openai";
import { chatCompletions } from "./utils";

/** 总结群聊消息 */
const summarize = async (
	groupId: number,
	options?: {
		/** 消息数量 */
		count?: number;
	},
) => {
	// 获取群历史消息
	const [error, response] = await to(
		http.post("/get_group_msg_history", {
			[camelToSnake("groupId")]: groupId,
			count: options?.count,
		}),
	);
	if (error) {
		return `总结失败：${error.message}`;
	}

	const validation = safeParse(GetMessageHistoryResponseSchema, response);
	if (!validation.success) {
		return `总结失败：${validation.issues[0].message}`;
	}

	// 转换成 OpenAI API 消息
	const messages: ChatCompletionInputMessage[] = [];
	for (const e of validation.output.data.messages) {
		messages.push(
			...(await onebotToOpenai(e, {
				enableImageUnderstanding: false,
				forwardCount: 0,
			})),
		);
	}

	// 丢给模型总结
	const [error2, content] = await to(
		chatCompletions([
			{ role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
			...messages,
		]),
	);
	if (error2) {
		return `总结失败：${error2.message}`;
	}

	return content;
};

export default summarize;
