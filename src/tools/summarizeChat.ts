import { to } from "@nickyzj2023/utils";
import type { ChatCompletionMessageParam } from "openai/resources";
import { safeParse } from "valibot";
import { MODELS, SUMMARY_PROMPT, SYSTEM_PROMPT } from "@/constants";
import {
	type GetMessageHistoryResponse,
	GetMessageHistoryResponseSchema,
} from "@/schemas/onebot";
import { http } from "@/utils/onebot";
import { chatCompletions, onebotToOpenai } from "@/utils/openai";
import { modelRef } from "./changeModel";
import { defineTool } from "./utils";

export default defineTool(
	{
		type: "function",
		function: {
			name: "summarizeChat",
			description: "分析并总结当前群聊的消息历史。",
			parameters: {
				type: "object",
				properties: {
					count: {
						type: "number",
						description: "需要追溯的消息条数。",
						default: 30,
					},
				},
			},
		},
	},
	async (params: {
		count?: number;
		/** 群号，如果传了则通过 OneBot HTTP 接口获取群号历史消息 */
		groupId?: number;
		/** 总结提供的消息 */
		providedMessages?: ChatCompletionMessageParam[];
	}) => {
		const { count = 30, groupId, providedMessages } = params ?? {};
		if (!groupId && !providedMessages) {
			return "请提供用于总结的群号或消息数组";
		}

		const model = modelRef.value?.useCases.includes("json")
			? modelRef.value
			: MODELS.find((model) => model.useCases.includes("json"));
		if (!model) {
			return "还没有配置JSON Output模型";
		}

		const messages: ChatCompletionMessageParam[] = [];

		// 使用提供的消息
		if (providedMessages) {
			messages.push(...providedMessages);
		}
		// 使用手动获取的群历史消息
		else if (groupId) {
			const [error, response] = await to<GetMessageHistoryResponse>(
				http.post("/get_group_msg_history", {
					group_id: groupId,
					count,
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
			for (const e of validation.output.data.messages) {
				messages.push(...(await onebotToOpenai(e)));
			}
		}

		// 丢给模型总结
		const [error2, completion] = await to(
			chatCompletions(
				[{ role: "system", content: SUMMARY_PROMPT }, ...messages],
				{
					model,
				},
			),
		);
		if (error2) {
			return `总结失败：${error2.message}`;
		}

		return completion.content as string;
	},
);
