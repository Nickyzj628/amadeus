// --- OneBot 相关工具 ---

import { camelToSnake, fetcher, timeLog, to } from "@nickyzj2023/utils";
import type { GetForwardMessageResponse } from "../schemas/onebot/http";
import type {
	AtSegment,
	GroupMessageEvent,
	Segment,
	TextSegment,
} from "../schemas/onebot/http-post";

const http = fetcher(`http://127.0.0.1:${Bun.env.ONEBOT_HTTP_PORT}`);

// --- 消息段 ---

/** 是否为@当前机器人的消息段 */
export const isAtSelfSegment = (
	segment: Segment | undefined,
	e: Partial<GroupMessageEvent>,
): segment is AtSegment => {
	return (
		segment !== undefined &&
		segment.type === "at" &&
		Number(segment.data.qq) === e.self_id
	);
};

/** 是否为纯文本消息段 */
export const isTextSegment = (
	segment: Segment | undefined,
): segment is TextSegment => {
	return segment !== undefined && segment.type === "text";
};

/** 从纯文本消息段中提取出“/<fn> <...args>” */
export const textSegmentToCommand = (segment: TextSegment) => {
	const { text } = segment.data;
	if (!text.startsWith("/")) {
		return { fn: undefined, args: [] };
	}

	const [fn, ...args] = text.slice(1).split(" ");
	return { fn, args };
};

/** 是否为合并转发消息段 */
export const isForwardSegment = (e: GroupMessageEvent, segIndex = 0) => {
	const segment = e.message[segIndex];
	if (segment === undefined || segment.type !== "forward") {
		return false;
	}
	return segment;
};

/** 递归展开合并转发的消息 */
export const flattenForwardMessage = async (
	messageId: string,
	result: Segment[] = [],
) => {
	const [error, response] = await to(
		http.post<GetForwardMessageResponse>("/get_forward_msg", {
			[camelToSnake("messageId")]: messageId,
		}),
	);
	if (error) {
		timeLog(`查询合并转发消息失败：${error.message}`);
		return result;
	}

	const currentSegments: Segment[] = [];
	for (const message of response.data.messages) {
		const e = { message: [segment] } as GroupMessageEvent;
		const forwardSegment = isForwardSegment(e);
		const textSegment = isTextSegment(e);
		if (forwardSegment) {
			currentSegments.push(
				...(await flattenForwardMessage(forwardSegment.data.id, result)),
			);
		} else if (textSegment) {
			const message = {
				role: "user",
				content: textSegment.data.text,
			};
			currentSegments.push(message);
		}
	}

	return [...result, ...currentSegments];
};

/** 构造纯文本消息段 */
export const makeTextSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});

// --- 快速操作 ---

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
