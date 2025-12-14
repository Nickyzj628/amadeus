import type { GroupMessageEvent, Segment, TextSegment } from "./schemas/onebot";

// --- 消息段相关工具 ---

export const isAtSelfSegment = (e: GroupMessageEvent, segIndex = 0) => {
	const segment = e.message[segIndex];
	if (
		segment === undefined ||
		segment.type !== "at" ||
		Number(segment.data.qq) !== e.self_id
	) {
		return false;
	}
	return segment;
};

export const isTextSegment = (e: GroupMessageEvent, segIndex = 0) => {
	const segment = e.message[segIndex];
	if (segment === undefined || segment.type !== "text") {
		return false;
	}
	segment.data.text = segment.data.text.trim();
	return segment;
};

export const isCommandText = (segment: TextSegment) => {
	const { text } = segment.data;
	if (!text.startsWith("/")) {
		return false;
	}

	const [fn, ...args] = text.slice(1).split(" ");
	return { fn, args };
};

/** 构造纯文本消息段 */
export const makeTextSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});

// --- 快速操作相关工具 ---
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md#%E5%BF%AB%E9%80%9F%E6%93%8D%E4%BD%9C-1

/** 回复当前发送人 */
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
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
};
