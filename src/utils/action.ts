// --- 快速操作相关工具 ---
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md#%E5%BF%AB%E9%80%9F%E6%93%8D%E4%BD%9C-1

import type { Segment } from "../schemas/onebot/http-post";
import { makeTextSegment } from "./segment";

/** 回复当前发送人，不传参则返回空响应（必须响应请求，否则 OneBot 将一直等待直到超时） */
export const reply = (...segments: Segment[] | string[]) => {
	const isEmpty = segments.length === 0;
	if (isEmpty) {
		return new Response(undefined, { status: 204 });
	}

	const normalizedSegments = segments.map((segment) => {
		if (typeof segment === "string") {
			return makeTextSegment(segment);
		}
		return segment;
	});

	return new Response(
		JSON.stringify({
			reply: normalizedSegments,
			at_sender: true,
		}),
	);
};
