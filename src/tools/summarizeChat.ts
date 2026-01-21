import { to } from "@nickyzj2023/utils";
import type { ChatCompletionMessageParam } from "openai/resources";
import { SUMMARY_PROMPT, SYSTEM_PROMPT } from "@/constants";
import { getGroupMessageHistory } from "@/utils/onebot";
import { chatCompletions, onebotToOpenai } from "@/utils/openai";
import { defineTool } from "./utils";

export default defineTool(
	{
		type: "function",
		function: {
			name: "summarizeChat",
			description: "总结群聊消息历史",
			parameters: {
				type: "object",
				properties: {
					count: {
						type: "number",
						description: "需要追溯的消息条数",
						default: 30,
					},
				},
			},
		},
	},
	async (params: {
		count?: number;
		/** 使用群号获取历史消息来总结 */
		groupId?: number;
		/** 使用传入的消息直接总结 */
		messages?: ChatCompletionMessageParam[];
	}) => {
		const { count = 30, groupId, messages = [] } = params ?? {};
		if (!groupId && !messages.length) {
			return "总结失败：请提供用于总结的群号或消息数组";
		}

		// 如果提供群号，则手动获取群聊历史消息
		if (groupId) {
			const [error, response] = await to(
				getGroupMessageHistory(groupId, count),
			);
			if (error) {
				return `总结失败：${error.message}`;
			}
			// 转换成 OpenAI API 消息
			for (const e of response) {
				const message = await onebotToOpenai(e);
				messages.push(message);
			}
		}

		// 丢给模型总结
		const [error2, completion] = await to(
			chatCompletions(
				[
					// 注入人设
					{ role: "system", content: SYSTEM_PROMPT },
					// 移除触发工具的“总结一下”消息
					...messages.slice(0, -1),
					// 伪造总结指令
					{ role: "user", content: SUMMARY_PROMPT },
				],
				{
					disableMessagesOptimization: true,
				},
			),
		);
		if (error2) {
			return `总结失败：${error2.message}`;
		}

		return completion.content as string;
	},
);
