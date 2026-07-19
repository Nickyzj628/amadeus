import { sleep } from "@nickyzj2023/utils";
import { normalizeText } from "@/common/util.js";
import { isTextSegment, type Segment } from "@/onebot/schemas/http-post.js";
import { sendGroupMessage } from "./http.js";
import { textToSegment, userIdToAtSegment } from "./segment.js";

/** 构造回复消息体 */
export const makeReplyBody = (
	...segments: (string | Segment)[]
): { reply: Segment[]; at_sender: boolean } | undefined => {
	// 移除文本消息段里的不自然内容
	const normalizedSegments = segments.map((segment) => {
		if (typeof segment === "string") {
			return textToSegment(normalizeText(segment));
		}
		if (isTextSegment(segment)) {
			segment.data.text = normalizeText(segment.data.text);
		}
		return segment;
	});

	return {
		reply: normalizedSegments,
		at_sender: true,
	};
};

export const replyLikeHuman = async (
	content: string,
	groupId: number,
	options?: {
		/** 回复时显式 @ 发送人 */
		at?: number;
	},
) => {
	const paragraphs = content.split("\n").filter(Boolean);
	for (let i = 0; i < paragraphs.length; i++) {
		const paragraph = paragraphs[i]!;
		const segments: Segment[] = [textToSegment(paragraph)];

		// 如果是第一段话，且传了at参数，则@发送人
		if (i === 0 && options?.at) {
			segments.unshift(userIdToAtSegment(options.at));
			if (isTextSegment(segments[1])) {
				segments[1].data.text = ` ${segments[1].data.text}`;
			}
		}

		// 如果不是第一段话，则按字数等待一段时间再发送，模拟打字速度
		if (i !== 0) {
			await sleep(paragraph.length * 300);
		}

		// 发出消息
		await sendGroupMessage(groupId, segments);
	}
};
