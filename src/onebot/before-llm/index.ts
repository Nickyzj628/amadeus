import type { AgentEvent } from "@nickyzj2023/ai";
import type { ToolCallEvent, ToolResultEvent } from "@nickyzj2023/ai/agent";
import { createXMLText } from "@nickyzj2023/utils";
import config from "@/config.js";
import type { GroupMessageEvent, Segment } from "@/onebot/schemas/http-post.js";
import {
	resolveBiliLink,
	roomInfoToSegments,
	videoDetailToSegments,
} from "./bililink.js";

/**
 * 调用大模型之前的生命周期，如果消息无需模型处理，则返回要回复的消息段
 * @remarks 保证返回Segment数组，不抛异常
 */
export const beforeLLM = async (e: GroupMessageEvent): Promise<Segment[]> => {
	const dataString = JSON.stringify(e.message.map((segment) => segment.data));

	try {
		// 解析B站链接
		const { videoDetail, roomInfo } = await resolveBiliLink(dataString);
		if (videoDetail) {
			return videoDetailToSegments(videoDetail);
		}
		if (roomInfo) {
			return roomInfoToSegments(roomInfo);
		}

		// ...扩展出更多功能
		//
	} catch {}

	return [];
};

/**
 * 模型发出工具调用请求后、调用工具前的回调函数，可用于篡改e.args
 * @remarks 什么也不返回，也不抛异常
 */
export const beforeToolCall = async (
	e: GroupMessageEvent,
	tce: ToolCallEvent,
): Promise<void> => {
	try {
		// 文生图成功后，需要把图片发到指定的群号
		if (tce.name === "generate_image") {
			const _args = JSON.parse(tce.args);
			_args.groupId = e.group_id;
			tce.args = JSON.stringify(_args);
		}
	} catch {}
};

/**
 * 模型发出工具调用请求后、调用工具前的回调函数，可用于篡改e.args
 * @remarks 什么也不返回，也不抛异常
 */
export const afterToolResult = async (
	e: GroupMessageEvent,
	tre: ToolResultEvent,
	options: { turn: number },
): Promise<void> => {
	// 单轮对话超过一定次数，提醒模型早停
	if (options.turn > config.etc.maxTurnsToReply) {
		tre.result = createXMLText(
			"system-reminder",
			`本次对话已达轮次上限，请立即停止并回复用户，可以询问用户是否继续调查`,
		);
	}
};
