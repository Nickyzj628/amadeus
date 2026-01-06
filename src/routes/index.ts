import { compactStr, loopUntil, timeLog, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import {
	MAX_TOOL_COUNT,
	REPLY_PROBABILITY_NOT_BE_AT,
	SYSTEM_PROMPT,
} from "@/constants";
import { GroupMessageEventSchema } from "@/schemas/onebot";
import { chooseAndHandleTool, tools } from "@/tools";
import { isAtSelfSegment, normalizeText, reply } from "@/utils/onebot";
import {
	chatCompletions,
	onebotToOpenai,
	pendingGroups,
	readGroupMessages,
	textToMessage,
} from "@/utils/openai";

export const rootRoute = {
	POST: async (req: Request) => {
		// 验证请求体格式，隐式保留了文字、图片、@、转发、回复消息段
		const body = await req.json();
		const validation = safeParse(GroupMessageEventSchema, body);
		if (!validation.success) {
			return reply();
		}
		const e = validation.output;

		// 拦截不是@当前机器人的消息（极小概率放行）
		const atSegmentIndex = e.message.findIndex(isAtSelfSegment);
		if (atSegmentIndex === -1 && Math.random() > REPLY_PROBABILITY_NOT_BE_AT) {
			return reply();
		}

		// 限制每个群只能同时处理一条消息
		const groupId = e.group_id;
		if (pendingGroups.includes(groupId)) {
			return reply("正在处理上一条消息，请稍候……");
		}
		pendingGroups.push(groupId);

		// 读取机器人相关群聊消息
		const messages = readGroupMessages(groupId, [
			textToMessage(SYSTEM_PROMPT, { role: "system" }),
		]);
		const currentMessage = await onebotToOpenai(e, {
			enableImageUnderstanding: true,
		});
		messages.push(currentMessage);
		timeLog("接收消息", currentMessage.content);

		// 循环请求模型，直到不再调用工具
		const [error, response] = await to(
			loopUntil(
				async (count) => {
					// 发出请求
					const completion = await chatCompletions(messages, {
						body: { tools },
					});
					messages.push(completion);

					// 调用工具
					const toolCalls = (completion.tool_calls ?? []).filter(
						(call) => call.type === "function",
					);
					if (toolCalls.length > 0) {
						// 如果在调用工具时超过最大请求次数，则抛出异常
						if (count === MAX_TOOL_COUNT) {
							throw new Error(
								`单次聊天调用的工具次数超过限制（${MAX_TOOL_COUNT}），已停止响应`,
							);
						}
						// 遍历模型想要调用的工具
						for (const tool of toolCalls) {
							const toolResult = await chooseAndHandleTool(tool, e);
							timeLog(
								`已调用工具${tool.function.name}`,
								compactStr(toolResult),
							);
							messages.push(
								textToMessage(toolResult, {
									role: "tool",
									tool_call_id: tool.id,
								}),
							);
						}
					}

					return completion;
				},
				{
					maxRetries: MAX_TOOL_COUNT,
					shouldStop: (completion) => !completion.tool_calls,
				},
			),
		);
		pendingGroups.splice(pendingGroups.indexOf(groupId), 1);

		// 回复消息
		if (error) {
			return reply(error.message);
		}
		if (response.content) {
			const content = normalizeText(response.content);
			timeLog("回复消息", content);
			return reply(content);
		}
		return reply("……");
	},
};
