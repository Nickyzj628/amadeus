import { to } from "@nickyzj2023/utils";
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from "openai/resources";
import { safeParse } from "valibot";
import { SUMMARY_PROMPT } from "@/constants";
import {
	type GetMessageHistoryResponse,
	GetMessageHistoryResponseSchema,
	type GroupMessageEvent,
} from "@/schemas/onebot";
import { http } from "@/utils/onebot";
import { chatCompletions, onebotToOpenai } from "@/utils/openai";

export default {
	tool: {
		type: "function",
		function: {
			name: "summarizeChat",
			description:
				"分析并总结当前群聊的消息历史。当用户要求了解‘大家在聊什么’、‘错过了什么’或需要回顾近期讨论重点时调用。",
			parameters: {
				type: "object",
				properties: {
					count: {
						type: "number",
						description: "需要追溯的消息条数，默认为 30 条。",
						default: 30,
					},
				},
			},
		},
	} as ChatCompletionTool,

	/**
	 * 工具处理逻辑
	 */
	handle: async ({ count }: { count?: number }, e: GroupMessageEvent) => {
		// 获取群历史消息
		const [error, response] = await to<GetMessageHistoryResponse>(
			http.post("/get_group_msg_history", {
				group_id: e.group_id,
				count: count ?? 30,
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
		const messages: ChatCompletionMessageParam[] = [];
		for (const e of validation.output.data.messages) {
			messages.push(
				...(await onebotToOpenai(e, {
					enableImageUnderstanding: true,
				})),
			);
		}

		// 丢给模型总结
		const [error2, completion] = await to(
			chatCompletions([
				{ role: "system", content: SUMMARY_PROMPT },
				...messages,
			]),
		);
		if (error2) {
			return `总结失败：${error2.message}`;
		}

		return completion.content as string;
	},
};
