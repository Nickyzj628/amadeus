import type {
	ForwardSegment,
	ImageSegment,
	MinimalMessageEvent,
	Segment,
	TextSegment,
} from "@/schemas/onebot/http-post.js";
import { getForwardMessages } from "./http.js";

/** 从纯文本消息段中提取出"/<fn> <...args>" */
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

/** 从图片 URL 构造图片消息段 */
export const srcToImageSegment = (src: string): ImageSegment => ({
	type: "image",
	data: { url: src },
});

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
