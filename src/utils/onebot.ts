import { fetcher, isNil, timeLog, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import {
	type AtSegment,
	type CommonSegment,
	type ForwardSegment,
	GetForwardMessageResponseSchema,
	GetMessageHistoryResponseSchema,
	type GetMessageResponse,
	GetMessageResponseSchema,
	type ImageSegment,
	type MinimalMessageEvent,
	type ReplySegment,
	type Segment,
	type TextSegment,
} from "@/schemas/onebot";

export const http = fetcher(`http://127.0.0.1:${Bun.env.ONEBOT_HTTP_PORT}`);

// ================================
// 消息段相关工具
// ================================

/** 是否为@某人的消息段 */
export const isAtSegment = (segment?: CommonSegment): segment is AtSegment => {
	return !isNil(segment) && segment.type === "at";
};

/** 是否为@当前机器人的消息段 */
export const isAtSelfSegment = (
	segment?: CommonSegment,
): segment is AtSegment => {
	return (
		isAtSegment(segment) && Number(segment.data.qq) === Number(Bun.env.SELF_ID)
	);
};

/** 是否为纯文本消息段 */
export const isTextSegment = (
	segment?: CommonSegment,
): segment is TextSegment => {
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
export const isForwardSegment = (
	segment?: CommonSegment,
): segment is ForwardSegment => {
	return !isNil(segment) && segment.type === "forward";
};

/**
 * 递归查询转发消息详情
 * @remarks 保证安全返回数组，即使报错也返回空数组
 */
const getForwardMessages = async (
	messageId: string,
	count: number,
): Promise<MinimalMessageEvent[]> => {
	const [error, response] = await to(getForwardMessage(messageId));
	if (error) {
		timeLog(`查询合并转发消息失败：${error.message}`);
		return [];
	}

	const result: MinimalMessageEvent[] = [];
	const restCount = response.reduce((acc, e) => acc - e.content.length, count);

	for (const e of response) {
		const { sender } = e;
		for (const segment of e.content) {
			// 递归添加深层转发消息
			if (isForwardSegment(segment) && restCount > 0) {
				result.push(...(await getForwardMessages(segment.data.id, restCount)));
			}
			// 添加当前消息
			else {
				result.push({ sender, message: [segment] });
			}
		}
	}

	return result;
};

/**
 * 递归展开合并转发的消息
 * @remarks 保证安全返回数组
 */
export const flattenForwardSegment = async <T = Segment>(
	messageId: ForwardSegment["data"]["id"],
	options?: {
		/** 把消息转换成期望的类型 */
		processMessageEvent?: (e: MinimalMessageEvent) => Promise<T>;
		/** 递归展开的消息数量，默认 50 */
		count?: number;
	},
): Promise<T[]> => {
	const resultItems: T[] = [];
	const {
		processMessageEvent = (async (e) => e.message) as (
			e: MinimalMessageEvent,
		) => Promise<T>,
		count = 50,
	} = options ?? {};

	const forwardMessages = await getForwardMessages(messageId, count);

	// 把消息转换成期望的格式
	for (const e of forwardMessages) {
		const item = await processMessageEvent(e);
		resultItems.push(item);
	}

	return resultItems;
};

/** 是否为图片消息段 */
export const isImageSegment = (
	segment?: CommonSegment,
): segment is ImageSegment => {
	return !isNil(segment) && segment.type === "image";
};

/** 是否为回复消息段 */
export const isReplySegment = (
	segment?: CommonSegment,
): segment is ReplySegment => {
	return !isNil(segment) && segment.type === "reply";
};

/** 移除文本中的不自然内容 */
export const normalizeText = (text: string) => {
	return (
		text
			// 移除可能残留的思考标签及其内容
			.replace(/<think>[\s\S]*?<\/think>/gi, "")
			// 移除孤立的闭合思考标签
			.replace(/<\/think>/gi, "")
			// 提取[BODY: xxx]标签中的内容
			.replace(/\[BODY:(.*?)\]/gi, "$1")
			// 移除[FROM]和[IMAGE_PARSED]元数据标签
			.replace(/\[FROM:.*?\]|\[IMAGE_PARSED:.*?\]/gi, "")
			.trim()
	);
};

// ================================
// 快速操作
// ================================

/** 回复当前发送人，不传参则返回空响应（必须响应请求，否则 OneBot 将一直等待直到超时） */
export const reply = (...segments: (string | Segment)[]) => {
	const isEmpty = !segments?.length;
	if (isEmpty) {
		return new Response(null, { status: 204 });
	}

	const normalizedSegments = segments.map((segment) => {
		if (typeof segment === "string") {
			return textToSegment(segment);
		} else if (isTextSegment(segment)) {
			segment.data.text = normalizeText(segment.data.text);
		}
		return segment;
	});

	return new Response(
		JSON.stringify({
			reply: normalizedSegments,
		}),
	);
};

// ================================
// HTTP 请求
// ================================

/**
 * 获取群历史消息
 * @see https://api.luckylillia.com/api-156808591
 */
export const getGroupMessageHistory = async (groupId: number, count = 30) => {
	const response = await http.post("/get_group_msg_history", {
		group_id: groupId,
		count,
	});

	const validation = safeParse(GetMessageHistoryResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data.messages;
};

/**
 * 获取消息详情
 * @see https://api.luckylillia.com/api-147574979
 */
export const getMessage = async (messageId: string) => {
	const response = await http.post("/get_msg", {
		message_id: messageId,
	});

	const validation = safeParse(GetMessageResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data;
};

/**
 * 获取转发消息详情
 * @see https://api.luckylillia.com/api-159742006
 */
export const getForwardMessage = async (messageId: string) => {
	const response = await http.post("/get_forward_msg", {
		message_id: messageId,
	});

	const validation = safeParse(GetForwardMessageResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data.messages;
};

/**
 * 发送群聊文本消息
 * @see https://api.luckylillia.com/api-226300081
 */
export const sendGroupMessage = async (
	groupId: number,
	message: CommonSegment[],
) => {
	return http.post("/send_group_msg", {
		group_id: groupId,
		message,
	});
};
