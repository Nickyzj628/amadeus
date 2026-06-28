import type {
	AtSegment,
	ImageSegment,
	TextSegment,
} from "@/onebot/schemas/http-post.js";

/** 构造纯文本消息段 */
export const textToSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});

/** 构造 @ 消息段 */
export const userIdToAtSegment = (
	userId: string | number | "all",
): AtSegment => ({
	type: "at",
	data: { qq: String(userId) },
});

/** 从图片 URL 构造图片消息段 */
export const srcToImageSegment = (src: string): ImageSegment => ({
	type: "image",
	data: { url: src },
});
