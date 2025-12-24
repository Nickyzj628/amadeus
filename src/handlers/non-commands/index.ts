import type { GroupMessageEvent } from "@/schemas/onebot/http-post";
import { isTextSegment } from "@/utils/onebot";
import ai from "./ai";
import nbnhhsh from "./nbnhhsh";

export const handleText = (e: GroupMessageEvent) => {
	// 先尝试匹配纯英文缩写，调用能不能好好说话
	const [segment1] = e.message;
	if (isTextSegment(segment1)) {
		const { text } = segment1.data;
		if (/^[A-Za-z]+$/.test(text) && !nbnhhsh.IGNORED_TEXTS.includes(text)) {
			return nbnhhsh.handle(text);
		}
	}

	return ai.handle("chat", e);
};
