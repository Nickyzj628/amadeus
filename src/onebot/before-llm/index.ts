import type { AgentEvent } from "@nickyzj2023/ai";
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

export type ToolCallEvent = Extract<AgentEvent, { type: "tool_call" }>;

/**
 * 模型发出工具调用请求后、调用工具前的回调函数，可用于篡改e.args
 * @remarks 什么也不返回，也不抛异常
 */
export const beforeToolCall = async (
	e: GroupMessageEvent,
	tce: ToolCallEvent,
): Promise<void> => {
	try {
		if (tce.name === "generate_image") {
			const _args = JSON.parse(tce.args);
			_args.groupId = e.group_id;
			tce.args = JSON.stringify(_args);
		}
	} catch {}
};
