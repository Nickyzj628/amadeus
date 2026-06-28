import type { GroupMessageEvent, Segment } from "@/onebot/schemas/http-post.js";
import {
	resolveBiliLink,
	roomInfoToSegments,
	videoDetailToSegments,
} from "./bililink.js";

let lastHandleDate = 0;

/**
 * 调用大模型之前的生命周期，如果消息无需模型处理，则返回要回复的消息段
 * @remarks 保证返回 Segment 数组，不抛异常
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
	} catch {
	} finally {
		lastHandleDate = Date.now();
	}

	return [];
};
