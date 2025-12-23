import { camelToSnake, fetcher, isNil, timeLog, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { selfId } from "..";
import {
	type ForwardMessage,
	type GetForwardMessageResponse,
	GetForwardMessageResponseSchema,
} from "../schemas/onebot/http";
import type {
	AtSegment,
	ForwardSegment,
	ImageSegment,
	MinimalMessageEvent,
	Segment,
	TextSegment,
} from "../schemas/onebot/http-post";
import type { ChatCompletionInputMessage } from "../schemas/openai";
import { onebotToOpenai } from "./openai";

const http = fetcher(`http://127.0.0.1:${Bun.env.ONEBOT_HTTP_PORT}`);

// ================================
// 消息段相关工具
// ================================

/** 是否为@某人的消息段 */
export const isAtSegment = (segment?: Segment): segment is AtSegment => {
	return !isNil(segment) && segment.type === "at";
};

/** 是否为@当前机器人的消息段 */
export const isAtSelfSegment = (
	segment: Segment | undefined,
): segment is AtSegment => {
	return isAtSegment(segment) && Number(segment.data.qq) === selfId;
};

/** 是否为纯文本消息段 */
export const isTextSegment = (segment?: Segment): segment is TextSegment => {
	return !isNil(segment) && segment.type === "text";
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

/** 构造纯文本消息段 */
export const textToSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});

/** 是否为合并转发消息段 */
export const isForwardSegment = (segment?: Segment) => {
	return !isNil(segment) && segment.type === "forward";
};

/** 是否为合并转发消息段 */
export const isReplySegment = (segment?: Segment) => {
	return !isNil(segment) && segment.type === "reply";
};

/**
 * 递归展开合并转发的消息
 * @param messageId 合并转发 ID
 * @param options 可以指定 processMessage 把消息处理成期望的类型，这里的消息是 OpenAI API 格式，别问为什么
 */
export const flattenForwardSegment = async <T = ChatCompletionInputMessage>(
	messageId: ForwardSegment["data"]["id"],
	options?: {
		processMessage?: (message: ChatCompletionInputMessage) => T;
	},
): Promise<T[]> => {
	const resultItems: T[] = [];
	const {
		processMessage = ((message) => message) as (
			message: ChatCompletionInputMessage,
		) => T,
	} = options ?? {};

	const getForwardMessages = async (
		messageId: string,
	): Promise<ForwardMessage[]> => {
		const [error, response] = await to(
			http.post<GetForwardMessageResponse>("/get_forward_msg", {
				[camelToSnake("messageId")]: messageId,
			}),
		);
		if (error) {
			timeLog(`查询合并转发消息失败：${error.message}`);
			return [];
		}

		const validation = safeParse(GetForwardMessageResponseSchema, response);
		if (!validation.success) {
			timeLog(`解析合并转发消息失败：${validation.issues[0].message}`);
			return [];
		}

		return validation.output.data.messages;
	};
	const forwardMessages = await getForwardMessages(messageId);

	// 把消息转换成期望的格式
	for (const message of forwardMessages) {
		const e: MinimalMessageEvent = {
			message: message.content,
			sender: message.sender,
		};
		resultItems.push(...(await onebotToOpenai(e)).map(processMessage));
	}

	return resultItems;
};

/**
 * 递归展开回复的消息
 * @param messageId 回复 ID
 * @param options 可以指定 processMessage 把消息处理成期望的类型，这里的消息是 OpenAI API 格式，别问为什么
 */
export const flattenForwardSegment = async <T = ChatCompletionInputMessage>(
	messageId: ForwardSegment["data"]["id"],
	options?: {
		processMessage?: (message: ChatCompletionInputMessage) => T;
	},
): Promise<T[]> => {
	const resultItems: T[] = [];
	const {
		processMessage = ((message) => message) as (
			message: ChatCompletionInputMessage,
		) => T,
	} = options ?? {};

	const getForwardMessages = async (
		messageId: string,
	): Promise<ForwardMessage[]> => {
		const [error, response] = await to(
			http.post<GetForwardMessageResponse>("/get_forward_msg", {
				[camelToSnake("messageId")]: messageId,
			}),
		);
		if (error) {
			timeLog(`查询合并转发消息失败：${error.message}`);
			return [];
		}

		const validation = safeParse(GetForwardMessageResponseSchema, response);
		if (!validation.success) {
			timeLog(`解析合并转发消息失败：${validation.issues[0].message}`);
			return [];
		}

		return validation.output.data.messages;
	};
	const forwardMessages = await getForwardMessages(messageId);

	// 把消息转换成期望的格式
	for (const message of forwardMessages) {
		const e: MinimalMessageEvent = {
			message: message.content,
			sender: message.sender,
		};
		resultItems.push(...(await onebotToOpenai(e)).map(processMessage));
	}

	return resultItems;
};

/** 是否为图片消息段 */
export const isImageSegment = (segment?: Segment): segment is ImageSegment => {
	return !isNil(segment) && segment.type === "image";
};

// --- 快速操作 ---

/** 回复当前发送人，不传参则返回空响应（必须响应请求，否则 OneBot 将一直等待直到超时） */
export const reply = (...segments: Segment[] | string[]) => {
	const isEmpty = segments.length === 0;
	if (isEmpty) {
		return new Response(undefined, { status: 204 });
	}

	const normalizedSegments = segments.map((segment) => {
		if (typeof segment === "string") {
			return textToSegment(segment);
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
