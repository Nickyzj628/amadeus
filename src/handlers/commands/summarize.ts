import ai from "../non-commands/ai";
import { defineCommand } from ".";

/** 总结一下 */
export default defineCommand({
	description: "归纳总结最近的群聊内容",
	example: "/总结一下",
	handle: (args, e) => {
		return ai.handle("summarize", e);
	},
});
