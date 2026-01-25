import { isNil, loopUntil, mapValues, to } from "@nickyzj2023/utils";
import type { ChatCompletionMessage } from "openai/resources";
import { safeParse } from "valibot";
import {
	MAX_REQUEST_COUNT,
	REPLY_PROBABILITY_NOT_BE_AT,
	SYSTEM_PROMPT,
} from "@/constants";
import { GroupMessageEventSchema } from "@/schemas/onebot";
import { handleTool, tools } from "@/tools";
import {
	isAtSelfSegment,
	reply,
	sendGroupMessage,
	textToSegment,
} from "@/utils/onebot";
import {
	chatCompletions,
	onebotToOpenai,
	pendingGroupIds,
	readGroupMessages,
	saveGroupMessages,
	textToMessage,
} from "@/utils/openai";

export const rootRoute = {
	POST: async (req: Request) => {
		// 验证请求体格式（在 schema 校验阶段保留了文字、图片、@、转发、回复消息段）
		const body = await req.json();
		const validation = safeParse(GroupMessageEventSchema, body);
		if (!validation.success) {
			return reply();
		}
		const e = validation.output;

		// 拦截不是 @ 当前机器人的消息（极小概率放行）
		const isAtSelf = e.message.findIndex(isAtSelfSegment) !== -1;
		if (!isAtSelf && Math.random() > REPLY_PROBABILITY_NOT_BE_AT) {
			return reply();
		}

		// 限制每个群只能同时处理一条消息
		const groupId = e.group_id;
		if (pendingGroupIds.includes(groupId)) {
			if (!isAtSelf) {
				return reply();
			}
			return reply("正在处理其他消息，请稍后再试...");
		}
		pendingGroupIds.push(groupId);

		// 读取群聊消息
		const [error, messages] = await to(
			readGroupMessages(groupId, [
				textToMessage(SYSTEM_PROMPT, { role: "system" }),
			]),
		);
		if (error) {
			return reply(`读取群聊消息失败：${error.message}`);
		}

		// 处理当前消息
		const currentMessage = await onebotToOpenai(e, {
			enableImageUnderstanding: true,
			enableExtraContextBlock: !isAtSelf,
		});
		const currentMessageIndex = messages.push(currentMessage) - 1;

		// 不断请求模型，直到给出回复
		const [error2, response] = await to(
			loopUntil(
				async () => {
					// 发出请求
					const completion = await chatCompletions(messages, {
						body: { tools },
						disableMessagesOptimization: messages.at(-1)?.role === "tool", // 调用工具的途中不优化上下文
					});
					messages.push(completion);

					// 处理 function calling
					const functionCalls = (completion.tool_calls ?? []).filter(
						(call) => call.type === "function",
					);
					for (const tool of functionCalls) {
						const { content, replyDirectly } = await handleTool(tool, e);
						// 如果工具结果可以直接回复给用户，则先清除调用痕迹，再回复
						if (replyDirectly) {
							messages.splice(
								currentMessageIndex + 1,
								messages.length,
								textToMessage(content, {
									role: "assistant",
								}),
							);
							return { content } as ChatCompletionMessage;
						}
						// 带着工具结果进入下个循环
						messages.push(
							textToMessage(content, {
								role: "tool",
								tool_call_id: tool.id,
							}),
						);
					}

					return completion;
				},
				{
					maxRetries: MAX_REQUEST_COUNT,
					shouldStop: (completion) => !completion.tool_calls,
				},
			),
		);
		pendingGroupIds.splice(pendingGroupIds.indexOf(groupId), 1);

		// 如果报错，则撤回本轮消息
		if (error2) {
			messages.splice(currentMessageIndex, messages.length);
		}
		if (error2 && isAtSelf) {
			return reply(error2.message);
		}
		if (!response?.content) {
			return reply();
		}

		// 回复消息
		to(saveGroupMessages(groupId, messages, { disableGC: true }));
		if (isAtSelf) {
			return reply(response.content);
		}
		sendGroupMessage(groupId, [textToSegment(response.content)]);
		return reply();
	},
};
