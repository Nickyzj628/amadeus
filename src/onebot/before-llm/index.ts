import { log } from "@nickyzj2023/utils";
import type { GroupMessageEvent, Segment } from "@/onebot/schemas/http-post.js";
import { resolveBiliLink } from "./bililink.js";

/**
 * 调用大模型之前的生命周期，如果消息无需模型处理，则返回要回复的消息段
 * @remarks 保证返回数组，不抛异常
 */
export const beforeLLM = async (e: GroupMessageEvent): Promise<Segment[]> => {
	const stringifiedSegmentData = JSON.stringify(
		e.message.map((segment) => segment.data),
	);

	try {
		// 解析B站链接
		const resolvedBiliLink = await resolveBiliLink(stringifiedSegmentData, {
			shouldToSegments: true,
		});
		if (resolvedBiliLink) {
			return resolvedBiliLink.segments;
		}

		// ...扩展出更多功能
	} catch (error) {
		log(`beforeLLM抛出异常：${error}`);
	}

	return [];
};
