// --- OneBot 消息段相关工具 ---

import { camelToSnake, fetcher, timeLog, to } from "@nickyzj2023/utils";
import type { GetForwardMessageResponse } from "../schemas/onebot/http";
import type {
	GroupMessageEvent,
	TextSegment,
} from "../schemas/onebot/http-post";
import type { ChatCompletionMessage } from "../schemas/openai";

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

/** 是否为“/<纯文本>”格式的消息段 */
export const isCommandText = (segment: TextSegment) => {
	const { text } = segment.data;
	if (!text.startsWith("/")) {
		return false;
	}

	const [fn, ...args] = text.slice(1).split(" ");
	return { fn, args };
};

export const isForwardSegment = (e: GroupMessageEvent, segIndex = 0) => {
	const segment = e.message[segIndex];
	if (segment === undefined || segment.type !== "forward") {
		return false;
	}
	return segment;
};

/** 递归展开合并转发的消息 */
export const getForwardMessage = async (
	messageId: string,
	result: ChatCompletionMessage[] = [],
) => {
	const [error, response] = await to(
		fetcher("http://127.0.0.1:7280").post<GetForwardMessageResponse>(
			"/get_forward_msg",
			{
				[camelToSnake("messageId")]: messageId,
			},
		),
	);
	if (error) {
		timeLog(`调用POST /get_forward_msg失败：${error.message}`);
		return result;
	}

	const currentMessages: ChatCompletionMessage[] = [];
	for (const segment of response.data) {
		const e = { message: [segment] } as GroupMessageEvent;
		const forwardSegment = isForwardSegment(e);
		const textSegment = isTextSegment(e);
		if (forwardSegment) {
			currentMessages.push(
				...(await getForwardMessage(forwardSegment.data.id, result)),
			);
		} else if (textSegment) {
			const message = {
				role: "user",
				content: textSegment.data.text,
			};
			currentMessages.push(message);
		}
	}

	return [...result, ...currentMessages];
};

/** 构造纯文本消息段 */
export const makeTextSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});
