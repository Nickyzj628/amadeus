import { loopUntil, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import {
	MAX_REQUEST_COUNT,
	REPLY_PROBABILITY_NOT_BE_AT,
	SYSTEM_PROMPT,
} from "@/constants";
import { type CommonSegment, GroupMessageEventSchema } from "@/schemas/onebot";
import { handleTool, tools } from "@/tools";
import { resolveBiliLink } from "@/utils/bili";
import { formatNumberCompact } from "@/utils/common";
import {
	isAtSelfSegment,
	reply,
	sendGroupMessage,
	srcToImageSegment,
	textToSegment,
} from "@/utils/onebot";
import {
	chatCompletions,
	contentToMessage,
	onebotToOpenaiMessages,
	pendingGroupIdsSet,
	readGroupMessages,
	saveGroupMessages,
	summarizeMessages,
} from "@/utils/openai";

export const rootRoute = {
	POST: async (req: Request) => {
		// 验证请求体格式（在 schema 校验阶段保留了文字、图片、@、转发、回复、小程序消息段）
		const body = await req.json();
		const validation = safeParse(GroupMessageEventSchema, body);
		if (!validation.success) {
			return reply();
		}

		// 过滤空消息
		const e = validation.output;
		if (e.message.length === 0) {
			return reply();
		}

		const groupId = e.group_id;
		const isAtSelf = e.message.findIndex(isAtSelfSegment) !== -1;

		// 限制每个群只能同时处理一条消息
		if (pendingGroupIdsSet.has(groupId)) {
			if (!isAtSelf) {
				return reply();
			}
			return reply(isAtSelf ? "正在处理其他消息，请稍后再试..." : "");
		}
		pendingGroupIdsSet.add(groupId);

		// 如果从消息中提取到B站链接，则解析并直接回复消息，不经过模型处理
		const [, resolvedBiliLink] = await to(
			resolveBiliLink(JSON.stringify(e.message.map((segment) => segment.data))),
		);
		if (resolvedBiliLink) {
			const { url, videoDetail, liveDetail } = resolvedBiliLink;
			const segments: CommonSegment[] = [];
			if (videoDetail) {
				const { pic, title, owner, duration, stat, pubdate } = videoDetail;
				segments.push(
					srcToImageSegment(pic),
					textToSegment(
						[
							title,
							`@${owner.name}`,
							"",
							`视频时长：${Math.floor(duration / 60)}分${duration % 60}秒`,
							`发布时间：${new Date(pubdate * 1000).toLocaleString()}`,
							`${formatNumberCompact(stat.view)}播放 ${formatNumberCompact(stat.like)}点赞 ${formatNumberCompact(stat.coin)}硬币 ${formatNumberCompact(stat.favorite)}收藏`,
							"",
							url,
						].join("\n"),
					),
				);
			}
			if (liveDetail) {
				const { live_status, live_time, title, user_cover, keyframe } =
					liveDetail;
				segments.push(
					srcToImageSegment(keyframe || user_cover),
					textToSegment(
						[
							title,
							"",
							`状态：${live_status === 1 ? "直播中" : "未开播"}`,
							`开播时间：${live_time}`,
							"",
							url,
						].join("\n"),
					),
				);
			}
			sendGroupMessage(groupId, segments);
			pendingGroupIdsSet.delete(groupId);
			return reply();
		}

		// 读取群聊消息
		const [error, messages] = await to(
			readGroupMessages(groupId, [
				contentToMessage(SYSTEM_PROMPT, { role: "system" }),
			]),
		);
		if (error) {
			pendingGroupIdsSet.delete(groupId);
			return reply(`读取群聊消息失败：${error.message}`);
		}

		// 消息溢出时总结
		const isSummarized = await summarizeMessages(messages);

		// 处理当前消息
		const currentMessages = await onebotToOpenaiMessages(e);
		const currentIndex = messages.length;
		messages.push(...currentMessages);

		// 拦截不是 @ 当前机器人的消息（极小概率放行）
		if (!isAtSelf && Math.random() > REPLY_PROBABILITY_NOT_BE_AT) {
			// 如果总结成功，即使不回复，也要保存消息回本地
			if (isSummarized) {
				to(saveGroupMessages(groupId, messages, { disableGC: true }));
			}
			pendingGroupIdsSet.delete(groupId);
			return reply();
		}

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

					// 处理工具调用请求
					const functionCalls = (completion.tool_calls ?? []).filter(
						(call) => call.type === "function",
					);
					for (const tool of functionCalls) {
						const content = await handleTool(tool, e);
						messages.push(
							contentToMessage(content, {
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
		pendingGroupIdsSet.delete(groupId);

		// 如果报错，则撤回本轮消息
		if (error2) {
			messages.splice(currentIndex, messages.length);
		}
		// 如果是在 @ 机器人时报错，则需要汇报错误信息
		if (error2 && isAtSelf) {
			return reply(error2.message);
		}
		// 抑制空信息
		if (!response?.content) {
			return reply();
		}

		to(saveGroupMessages(groupId, messages, { disableGC: true }));

		// 回复被动消息
		if (isAtSelf) {
			return reply(response.content);
		}

		// 回复主动消息
		sendGroupMessage(groupId, [textToSegment(response.content)]);
		return reply();
	},
};
