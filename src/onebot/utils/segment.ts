import type {
	AtSegment,
	ImageSegment,
	Segment,
	TextSegment,
} from "@/onebot/schemas/http-post.js";

/** 构造纯文本消息段 */
export const textToSegment = (text: string): TextSegment => ({
	type: "text",
	data: { text },
});

/** 构造@消息段 */
export const userIdToAtSegment = (
	userId: string | number | "all",
): AtSegment => ({
	type: "at",
	data: { qq: String(userId) },
});

/** 从图片URL构造图片消息段 */
export const urlToImageSegment = (url: string): ImageSegment => ({
	type: "image",
	data: { url },
});

/** 从消息段里提取出纯文本内容 */
export const extractTextFromSegments = (segments: Segment[]) => {
	return segments
		.filter((segment) => segment.type === "text")
		.map((segment) => segment.data.text)
		.join("\n");
};
