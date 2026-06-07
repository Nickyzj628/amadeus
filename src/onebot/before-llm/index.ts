import { to } from "@nickyzj2023/utils";
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
  // 10秒节流
  if (Date.now() - lastHandleDate <= 10000) {
    return [];
  }
  lastHandleDate = Date.now();

	const stringifiedSegmentData = JSON.stringify(
		e.message.map((segment) => segment.data),
	);

	// 解析B站链接
	const [, bililink] = await to(resolveBiliLink(stringifiedSegmentData));
	if (bililink) {
		const { videoDetail, roomInfo } = bililink;
		return videoDetail
			? videoDetailToSegments(videoDetail)
			: roomInfoToSegments(roomInfo);
	}

	// ...扩展出更多功能

	return [];
};
