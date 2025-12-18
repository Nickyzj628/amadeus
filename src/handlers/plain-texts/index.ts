import type { GroupMessageEvent } from "../../schemas/onebot/http-post";
import nbnhhsh from "./nbnhhsh";

export const handlePlainText = (text: string, e: GroupMessageEvent) => {
	if (/^[A-Za-z]+$/.test(text) && !nbnhhsh.IGNORED_TEXTS.includes(text)) {
		return nbnhhsh.handle(text);
	}
	return Ai.chat(e, message);
};
